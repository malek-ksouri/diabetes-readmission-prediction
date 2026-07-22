"""
prediction.py
=============
Pipeline d'inférence complet : données patient brutes → risque + SHAP.
Utilisé par l'API FastAPI et le dashboard.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from feature_engineering import transform_features, COLONNES_MEDICAMENTS

# =============================================================
# CHARGEMENT DES ARTEFACTS (une seule fois au démarrage)
# =============================================================

# Chemins (à adapter selon l'emplacement d'exécution)
BASE = Path(__file__).resolve().parent.parent  # racine du projet
PREPROCESSOR_PATH = BASE / "artifacts" / "preprocessor.pkl"
MODEL_PATH = BASE / "models" / "lgbm_final_calibrated.pkl"
SEUIL_PATH = BASE / "models" / "seuil_officiel.json"

_preprocessor = None
_model = None
_seuil = None
_explainer = None


def charger_artefacts():
    """Charge le preprocessor, le modèle calibré et le seuil (lazy)."""
    global _preprocessor, _model, _seuil, _explainer
    if _preprocessor is None:
        _preprocessor = joblib.load(PREPROCESSOR_PATH)
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    if _seuil is None:
        with open(SEUIL_PATH) as f:
            _seuil = json.load(f)["seuil"]
    return _preprocessor, _model, _seuil


# =============================================================
# VALEURS PAR DÉFAUT (patient partiel → patient complet)
# =============================================================

def appliquer_defauts(patient: dict) -> dict:
    """
    Complète un patient partiel avec des valeurs par défaut sensées.
    Les médicaments non renseignés sont mis à 'No' (option A).
    """
    p = dict(patient)  # copie

    # Médicaments par défaut = "No"
    for med in COLONNES_MEDICAMENTS:
        p.setdefault(med, "No")

    # Valeurs par défaut raisonnables pour les autres champs
    defauts = {
        "race": "Caucasian",
        "gender": "Female",
        "admission_type_id": "1",
        "discharge_disposition_id": "1",
        "admission_source_id": "1",
        "medical_specialty": "Missing",
        "change": "No",
        "diabetesMed": "Yes",
        "A1Cresult": None,      # non mesuré par défaut
        "max_glu_serum": None,  # non mesuré par défaut
        "num_procedures": 0,
        "number_outpatient": 0,
        "number_emergency": 0,
        "number_inpatient": 0,
    }
    for k, v in defauts.items():
        p.setdefault(k, v)

    return p


# =============================================================
# PIPELINE D'INFÉRENCE
# =============================================================

def preparer_patient(patient: dict) -> pd.DataFrame:
    """dict patient brut → 186 features prêtes pour le modèle."""
    preprocessor, _, _ = charger_artefacts()

    # 1. Compléter les champs manquants
    patient_complet = appliquer_defauts(patient)

    # 2. DataFrame 1 ligne
    df = pd.DataFrame([patient_complet])

    # 3. Feature engineering → 48 colonnes
    df_feat = transform_features(df)

    # 4. Preprocessing → 186 features
    X = preprocessor.transform(df_feat)
    return X


def predire_patient(patient: dict, top_n: int = 8) -> dict:
    """
    Fonction tout-en-un : patient brut → risque + classification + SHAP.
    C'est ce que l'API appellera.
    """
    preprocessor, model, seuil = charger_artefacts()

    # Préparer + prédire
    X = preparer_patient(patient)
    proba = float(model.predict_proba(X)[0, 1])
    a_risque = proba >= seuil

    # Niveau de risque (pour l'affichage)
    # Seuils relatifs au seuil de décision officiel et au taux de base (~9%).
    # "Très élevé" = risque > 1,2x le seuil clinique (≈ 5x le taux de base),
    # ce qui correspond à un patient à très haut risque relatif dans cette population.
    if proba < seuil * 0.6:
        niveau = "Faible"
    elif proba < seuil:
        niveau = "Modéré"
    elif proba < seuil * 1.2:
        niveau = "Élevé"
    else:
        niveau = "Très élevé"

    resultat = {
        "probabilite": round(proba, 4),
        "seuil": seuil,
        "a_risque": bool(a_risque),
        "niveau_risque": niveau,
        "recommandation": (
            "Suivi renforcé recommandé (contact post-sortie, éducation "
            "thérapeutique)." if a_risque else
            "Suivi standard."
        ),
    }

    # Explication SHAP (facteurs de risque du patient)
    try:
        resultat["facteurs"] = expliquer_patient(X, top_n=top_n)
    except Exception as e:
        resultat["facteurs"] = []
        resultat["shap_erreur"] = str(e)

    return resultat


def expliquer_patient(X, top_n: int = 8) -> list:
    """
    Calcule les valeurs SHAP pour un patient et renvoie les top_n facteurs
    (nom de la feature + contribution positive/négative au risque).
    """
    global _explainer
    import shap

    _, model, _ = charger_artefacts()

    # TreeSHAP sur le modèle de base (dans le CalibratedClassifierCV)
    # On récupère l'estimateur LightGBM sous-jacent
    base_model = _extraire_lgbm(model)
    if _explainer is None:
        _explainer = shap.TreeExplainer(base_model)

    shap_values = _explainer.shap_values(X)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_row = shap_values[0]

    # Noms des features (sortie du preprocessor)
    preprocessor, _, _ = charger_artefacts()
    feature_names = preprocessor.get_feature_names_out()

    # Top facteurs par |contribution|
    ordre = np.argsort(np.abs(shap_row))[::-1][:top_n]
    facteurs = []
    for idx in ordre:
        facteurs.append({
            "feature": str(feature_names[idx]),
            "contribution": round(float(shap_row[idx]), 4),
            "sens": "augmente" if shap_row[idx] > 0 else "diminue",
        })
    return facteurs


def _extraire_lgbm(calibrated_model):
    """Récupère le LightGBM sous-jacent d'un CalibratedClassifierCV."""
    # CalibratedClassifierCV stocke les modèles dans calibrated_classifiers_
    try:
        cc = calibrated_model.calibrated_classifiers_[0]
        # FrozenEstimator wrappe l'estimateur original
        est = cc.estimator
        if hasattr(est, "estimator"):  # FrozenEstimator
            return est.estimator
        return est
    except Exception:
        return calibrated_model