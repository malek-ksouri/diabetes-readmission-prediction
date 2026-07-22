"""
feature_engineering.py
======================
Transformations déterministes du feature engineering (reprises du NB03),
extraites en fonctions réutilisables pour l'inférence (dashboard / API).

Toutes les transformations sont FIXES (aucun apprentissage) et s'appliquent
aussi bien à 1 patient qu'à N patients.
"""

import pandas as pd
import numpy as np

# =============================================================
# MAPPINGS FIXES (repris du feature engineering)
# =============================================================

AGE_MAPPING = {
    "[0-10)": 5,   "[10-20)": 15,
    "[20-30)": 25, "[30-40)": 35,
    "[40-50)": 45, "[50-60)": 55,
    "[60-70)": 65, "[70-80)": 75,
    "[80-90)": 85, "[90-100)": 95,
}

MEDICAMENT_MAPPING = {"No": 0, "Steady": 1, "Up": 2, "Down": 3}
A1C_MAPPING = {"Norm": 1, ">7": 2, ">8": 3}
GLU_MAPPING = {"Norm": 1, ">200": 2, ">300": 3}
GENDER_MAPPING = {"Female": 0, "Male": 1}
BINARY_MAPPING = {"No": 0, "Yes": 1}
CHANGE_MAPPING = {"No": 0, "Ch": 1}

# Les 23 colonnes de médicaments d'origine
COLONNES_MEDICAMENTS = [
    "metformin", "repaglinide", "nateglinide", "chlorpropamide",
    "glimepiride", "acetohexamide", "glipizide", "glyburide",
    "tolbutamide", "pioglitazone", "rosiglitazone", "acarbose",
    "miglitol", "troglitazone", "tolazamide", "examide",
    "citoglipton", "insulin", "glyburide-metformin",
    "glipizide-metformin", "glimepiride-pioglitazone",
    "metformin-rosiglitazone", "metformin-pioglitazone",
]

# Colonnes constantes supprimées au feature engineering (figées en dur)
COLONNES_CONSTANTES = ["examide", "citoglipton", "glimepiride-pioglitazone"]

# Les 3 identifiants à traiter comme catégoriels (texte)
IDS_CATEGORIELS = ["discharge_disposition_id", "admission_type_id",
                   "admission_source_id"]

# Ordre EXACT des 48 colonnes attendues par le preprocessor
COLONNES_ATTENDUES = [
    "race", "gender", "admission_type_id", "discharge_disposition_id",
    "admission_source_id", "time_in_hospital", "medical_specialty",
    "num_lab_procedures", "num_procedures", "num_medications",
    "number_outpatient", "number_emergency", "number_inpatient",
    "diag_1", "diag_2", "diag_3", "number_diagnoses",
    "max_glu_serum", "A1Cresult",
    "metformin", "repaglinide", "nateglinide", "chlorpropamide",
    "glimepiride", "acetohexamide", "glipizide", "glyburide",
    "tolbutamide", "pioglitazone", "rosiglitazone", "acarbose",
    "miglitol", "troglitazone", "tolazamide", "insulin",
    "glyburide-metformin", "glipizide-metformin",
    "metformin-rosiglitazone", "metformin-pioglitazone",
    "change", "diabetesMed", "age_numeric", "age_group",
    "score_risque_hospitalier", "ratio_medicaments_procedures",
    "patient_complexe", "A1C_mesure", "glucose_mesure",
]


# =============================================================
# FONCTIONS DE TRANSFORMATION
# =============================================================

def age_group(age_num):
    """3 groupes basés sur Strack et al. (Figure 2)."""
    if pd.isna(age_num):
        return 1  # défaut : adultes
    if age_num < 30:
        return 0
    elif age_num < 60:
        return 1
    return 2


def grouper_icd9(code):
    """Regroupe un code ICD-9 en chapitre clinique (règle fixe, Strack Table 2)."""
    if pd.isna(code):
        return "Autre"
    code = str(code)
    if code.startswith("E") or code.startswith("V"):
        return "Autre"
    if code.startswith("250"):
        return "Diabete"
    try:
        num = float(code)
    except ValueError:
        return "Autre"
    if (390 <= num <= 459) or num == 785:
        return "Circulatoire"
    elif (460 <= num <= 519) or num == 786:
        return "Respiratoire"
    elif (520 <= num <= 579) or num == 787:
        return "Digestif"
    elif (580 <= num <= 629) or num == 788:
        return "Genito_urinaire"
    elif 710 <= num <= 739:
        return "Musculo_squelettique"
    elif 140 <= num <= 239:
        return "Neoplasmes"
    elif 800 <= num <= 999:
        return "Blessure"
    return "Autre"


def transform_features(df):
    """
    Applique le feature engineering complet à un DataFrame (1 ou N patients).
    Retourne un DataFrame avec les 48 colonnes attendues par le preprocessor,
    dans le bon ordre.

    Le DataFrame d'entrée doit contenir les colonnes BRUTES du patient
    (age en texte, gender en texte, médicaments en texte, etc.).
    """
    df = df.copy()

    # --- 1. Âge ---
    df["age_numeric"] = df["age"].map(AGE_MAPPING)
    df["age_group"] = df["age_numeric"].apply(age_group)
    df = df.drop(columns=["age"], errors="ignore")

    # --- 2. Variables binaires ---
    df["gender"] = df["gender"].map(GENDER_MAPPING)
    df["diabetesMed"] = df["diabetesMed"].map(BINARY_MAPPING)
    df["change"] = df["change"].map(CHANGE_MAPPING)

    # --- 3. Médicaments (ordinal) ---
    for col in COLONNES_MEDICAMENTS:
        if col in df.columns:
            df[col] = df[col].map(MEDICAMENT_MAPPING)

    # --- 4. Tests A1C / glucose (ordinal, NaN conservé) ---
    df["A1Cresult"] = df["A1Cresult"].map(A1C_MAPPING)
    df["max_glu_serum"] = df["max_glu_serum"].map(GLU_MAPPING)

    # --- 5. Diagnostics ICD-9 groupés ---
    for col in ["diag_1", "diag_2", "diag_3"]:
        df[col] = df[col].apply(grouper_icd9)

    # --- 6. Nouvelles variables ---
    df["score_risque_hospitalier"] = (
        df["number_inpatient"] + df["number_emergency"] + df["number_outpatient"]
    )
    df["ratio_medicaments_procedures"] = (
        df["num_medications"] / (df["num_procedures"] + 1)
    ).round(2)
    df["patient_complexe"] = (
        (df["number_diagnoses"] > 5) & (df["num_medications"] > 15)
    ).astype(int)
    df["A1C_mesure"] = df["A1Cresult"].notna().astype(int)
    df["glucose_mesure"] = df["max_glu_serum"].notna().astype(int)

    # --- 7. Identifiants en catégoriel (texte) ---
    for col in IDS_CATEGORIELS:
        df[col] = df[col].astype(str)

    # --- 8. Suppression des colonnes constantes ---
    df = df.drop(columns=COLONNES_CONSTANTES, errors="ignore")

    # --- 9. Réordonner selon les colonnes attendues ---
    df = df[COLONNES_ATTENDUES]

    return df