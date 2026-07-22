"""
generer_stats.py
================
Génère le fichier `reports/dashboard_stats.json` utilisé par la page Dashboard.

Ce script NE recalcule pas le modèle et NE modifie aucune donnée.
Il LIT le dataset nettoyé (69 987 séjours, la population réelle du modèle)
et EXPORTE des statistiques descriptives — la même logique que le notebook EDA.

À lancer UNE FOIS (ou à chaque fois que le dataset nettoyé change) :
    python generer_stats.py

Les statistiques décrivent le dataset NETTOYÉ (après déduplication du NB02),
c'est-à-dire exactement la population que le modèle apprend et prédit.
"""

import json
from pathlib import Path
from datetime import datetime

import pandas as pd

# =============================================================
# 1. LOCALISATION DU DATASET NETTOYÉ
# =============================================================
# On tente plusieurs emplacements probables. Si aucun ne marche,
# le script s'arrête avec un message clair (pas de plantage obscur).
# >>> Si ton fichier est ailleurs, ajoute son chemin en tête de cette liste.

BASE = Path(__file__).resolve().parent

CHEMINS_POSSIBLES = [
    BASE / "data" / "processed" / "data_clean.csv",
    BASE / "data" / "processed" / "diabetic_clean.csv",
    BASE / "data" / "processed" / "diabetic_cleaned.csv",
    BASE / "data" / "cleaned" / "diabetic_clean.csv",
    BASE / "data" / "processed" / "df_clean.csv",
    BASE / "data" / "interim" / "diabetic_clean.csv",
    BASE / "data" / "processed" / "cleaned.csv",
]


def trouver_dataset():
    """Retourne le premier chemin existant, sinon lève une erreur explicite."""
    for chemin in CHEMINS_POSSIBLES:
        if chemin.exists():
            return chemin
    # Aucun trouvé : message d'aide clair
    liste = "\n".join(f"  - {c}" for c in CHEMINS_POSSIBLES)
    raise FileNotFoundError(
        "\n\n❌ Dataset nettoyé introuvable. J'ai cherché ici :\n"
        f"{liste}\n\n"
        "👉 Solution : ouvre generer_stats.py et remplace la 1re ligne de\n"
        "   CHEMINS_POSSIBLES par le vrai chemin de ton CSV nettoyé.\n"
    )


# =============================================================
# 2. CALCUL DES STATISTIQUES (logique reprise de l'EDA)
# =============================================================

AGE_ORDER = ["[0-10)", "[10-20)", "[20-30)", "[30-40)", "[40-50)",
             "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"]


def calculer_stats(df: pd.DataFrame) -> dict:
    """Assemble toutes les statistiques descriptives dans un dictionnaire."""

    # --- Cible binaire (même définition que l'EDA et le pipeline) ---
    # Le dataset nettoyé peut avoir : une cible binaire (0/1), ou la colonne
    # 'readmitted' d'origine ('<30', '>30', 'NO'). On gère les deux cas
    # de façon robuste (on teste le contenu, pas seulement le dtype).
    if "readmitted_binary" in df.columns:
        cible = pd.to_numeric(df["readmitted_binary"], errors="coerce").fillna(0).astype(int)
    elif "readmitted" in df.columns:
        col = df["readmitted"]
        # Cas texte ('<30'/'>30'/'NO') → 1 si '<30', sinon 0
        if col.astype(str).str.contains("<30|>30|NO", regex=True).any():
            cible = (col.astype(str) == "<30").astype(int)
        else:
            # Cas déjà numérique (0/1)
            cible = pd.to_numeric(col, errors="coerce").fillna(0).astype(int)
    else:
        raise KeyError(
            "Aucune colonne cible trouvée. Le dataset doit contenir "
            "'readmitted' ou 'readmitted_binary'."
        )
    df = df.copy()
    df["_cible"] = cible

    total = len(df)
    n_positifs = int(cible.sum())
    taux_global = round(cible.mean() * 100, 1)

    stats = {}

    # --- Vue d'ensemble ---
    stats["apercu"] = {
        "total_sejours": total,
        "readmis_30j": n_positifs,
        "taux_readmission_pct": taux_global,
        "non_readmis": total - n_positifs,
    }

    # --- Taux de réadmission par tranche d'âge ---
    if "age" in df.columns:
        taux_age = (df.groupby("age")["_cible"].mean() * 100).round(1)
        taux_age = taux_age.reindex(AGE_ORDER).dropna()
        stats["taux_par_age"] = [
            {"groupe": idx, "taux": float(val)} for idx, val in taux_age.items()
        ]

    # --- Taux de réadmission par spécialité (top 8 par fréquence) ---
    if "medical_specialty" in df.columns:
        # On prend les spécialités les plus fréquentes (fiables statistiquement)
        freq = df["medical_specialty"].value_counts().head(8).index
        sous = df[df["medical_specialty"].isin(freq)]
        taux_spec = (sous.groupby("medical_specialty")["_cible"].mean() * 100).round(1)
        taux_spec = taux_spec.sort_values(ascending=False)
        stats["taux_par_specialite"] = [
            {"specialite": idx, "taux": float(val)} for idx, val in taux_spec.items()
        ]

    # --- Répartition de l'âge (distribution de la population) ---
    if "age" in df.columns:
        rep_age = df["age"].value_counts().reindex(AGE_ORDER).dropna()
        stats["repartition_age"] = [
            {"groupe": idx, "nombre": int(val)} for idx, val in rep_age.items()
        ]

    # --- Corrélations numériques avec la cible (facteurs les plus liés) ---
    # On exclut : la cible elle-même, et les identifiants techniques qui n'ont
    # aucun sens clinique (leur corrélation est un artefact du hasard).
    IDS_A_EXCLURE = [
        "_cible", "readmitted_binary", "readmitted",
        "encounter_id", "patient_nbr",
        "discharge_disposition_id", "admission_type_id", "admission_source_id",
    ]
    num = df.select_dtypes(include=["int64", "float64"])
    if "_cible" in num.columns:
        corr = num.corr()["_cible"]
        # On retire la cible et tous les identifiants de la liste des facteurs
        corr = corr.drop([c for c in IDS_A_EXCLURE if c in corr.index], errors="ignore")
        corr = corr.round(3)
        # On garde les 6 plus fortes en valeur absolue (vrais facteurs cliniques)
        corr_abs = corr.abs().sort_values(ascending=False).head(6)
        stats["correlations_cible"] = [
            {"variable": var, "correlation": float(corr[var])}
            for var in corr_abs.index
        ]

    # --- Répartition par sexe ---
    if "gender" in df.columns:
        rep_g = df["gender"].value_counts()
        stats["repartition_sexe"] = [
            {"sexe": idx, "nombre": int(val)} for idx, val in rep_g.items()
        ]

    # --- Quelques moyennes cliniques parlantes ---
    moyennes = {}
    for col in ["time_in_hospital", "num_medications", "number_diagnoses"]:
        if col in df.columns:
            moyennes[col] = round(float(df[col].mean()), 1)
    if moyennes:
        stats["moyennes"] = moyennes

    return stats


# =============================================================
# 3. EXÉCUTION
# =============================================================

def main():
    chemin = trouver_dataset()
    print(f"📂 Dataset trouvé : {chemin}")

    df = pd.read_csv(chemin)
    print(f"   {len(df):,} lignes chargées.")

    stats = calculer_stats(df)

    # Traçabilité : on note d'où viennent les chiffres et quand.
    sortie = {
        "_meta": {
            "genere_le": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "source": str(chemin.name),
            "nb_lignes": len(df),
            "note": "Statistiques descriptives du dataset nettoyé "
                    "(population réelle du modèle).",
        },
        **stats,
    }

    dossier_reports = BASE / "reports"
    dossier_reports.mkdir(exist_ok=True)
    fichier = dossier_reports / "dashboard_stats.json"
    with open(fichier, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, indent=2)

    print(f"✅ Statistiques écrites dans : {fichier}")
    print(f"   Taux de réadmission global : {stats['apercu']['taux_readmission_pct']}%")
    print(f"   Total séjours : {stats['apercu']['total_sejours']:,}")


if __name__ == "__main__":
    main()