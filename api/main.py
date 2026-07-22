"""
main.py
=======
API FastAPI qui expose le modèle de prédiction de réhospitalisation.

Lancer avec :
    uvicorn api.main:app --reload
Puis ouvrir http://127.0.0.1:8000/docs pour la documentation interactive.
"""

import sys
import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from io import StringIO

# Permettre l'import des modules de src/
BASE = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE / "src"))

from prediction import predire_patient
from api.schemas import PatientInput, PredictionOutput


# =============================================================
# CONFIGURATION DE L'API
# =============================================================

app = FastAPI(
    title="API Prédiction Réhospitalisation Diabétique",
    description="Prédit le risque de réhospitalisation précoce (<30j) "
                "de patients diabétiques, avec explication SHAP.",
    version="1.0.0",
)

# CORS : autorise le frontend React à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # en production, restreindre au domaine du frontend
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================
# ENDPOINTS
# =============================================================

@app.get("/health")
def health():
    """Vérifie que l'API tourne."""
    return {"status": "ok", "message": "API opérationnelle"}


@app.get("/model-info")
def model_info():
    """Renvoie les métriques et infos du modèle (transparence)."""
    try:
        # Seuil
        with open(BASE / "models" / "seuil_officiel.json") as f:
            seuil_info = json.load(f)

        # Métriques du test
        metrics_path = BASE / "reports" / "final_test_metrics.csv"
        metrics = {}
        if metrics_path.exists():
            df = pd.read_csv(metrics_path, index_col=0)
            metrics = df.to_dict()

        return {
            "modele": "LightGBM optimisé + calibré (Platt)",
            "seuil_decision": seuil_info.get("seuil"),
            "critere_seuil": seuil_info.get("critere"),
            "metriques_test": metrics,
            "note": "Outil d'aide à la décision. Ne remplace pas le jugement clinique.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard-stats")
def dashboard_stats():
    """
    Renvoie les statistiques descriptives du dataset (pour la page Dashboard).
    Ces stats sont pré-calculées par le script generer_stats.py et lues depuis
    un fichier JSON (rapide, pas de recalcul à chaque appel).
    """
    stats_path = BASE / "reports" / "dashboard_stats.json"
    if not stats_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Statistiques non trouvées. Lance d'abord : python generer_stats.py",
        )
    try:
        with open(stats_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/shap-global")
def shap_global():
    """
    Renvoie l'importance globale des features (SHAP), pour la page
    "Comprendre le modèle". Pré-calculé par le NB07 (sur le jeu de test).
    """
    shap_path = BASE / "reports" / "shap_importance.json"
    if not shap_path.exists():
        raise HTTPException(
            status_code=404,
            detail="SHAP non trouvé. Exporte-le depuis le NB07 (shap_importance.json).",
        )
    try:
        with open(shap_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rapport-pdf")
def rapport_pdf(patient: PatientInput):
    """
    Génère un rapport PDF d'évaluation pour un patient.
    Refait la prédiction puis produit le PDF.
    """
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    from rapport_pdf import generer_rapport_pdf

    patient_dict = patient.model_dump()
    resultat = predire_patient(patient_dict)
    pdf_bytes = generer_rapport_pdf(patient_dict, resultat)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=rapport_patient.pdf"},
    )


@app.post("/predict", response_model=PredictionOutput)
def predict(patient: PatientInput):
    """Prédit le risque de réhospitalisation pour UN patient."""
    try:
        patient_dict = patient.model_dump()
        resultat = predire_patient(patient_dict)
        return resultat
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de prédiction : {e}")


@app.post("/predict-batch")
async def predict_batch(file: UploadFile = File(...)):
    """
    Prédit pour plusieurs patients depuis un CSV.
    Renvoie les résultats triés par risque décroissant.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un CSV.")

    try:
        contenu = await file.read()
        df = pd.read_csv(StringIO(contenu.decode("utf-8")))

        resultats = []
        for i, ligne in df.iterrows():
            patient_dict = ligne.to_dict()
            res = predire_patient(patient_dict, top_n=3)
            resultats.append({
                "index": int(i),
                "probabilite": res["probabilite"],
                "a_risque": res["a_risque"],
                "niveau_risque": res["niveau_risque"],
            })

        # Trier par risque décroissant (priorisation)
        resultats.sort(key=lambda x: x["probabilite"], reverse=True)

        n_risque = sum(1 for r in resultats if r["a_risque"])
        return {
            "total_patients": len(resultats),
            "patients_a_risque": n_risque,
            "resultats": resultats,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de traitement : {e}")