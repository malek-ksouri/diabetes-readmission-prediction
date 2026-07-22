"""
schemas.py
==========
Modèles de données (Pydantic) pour l'API : définissent la structure et
la validation des requêtes/réponses.
"""

from typing import Optional
from pydantic import BaseModel, Field


# =============================================================
# ENTRÉE — données d'un patient
# =============================================================

class PatientInput(BaseModel):
    """
    Données brutes d'un patient pour la prédiction.
    Les médicaments non renseignés sont mis à 'No' par défaut côté pipeline.
    Seuls les champs cliniquement importants sont requis ; le reste a des défauts.
    """
    # --- Démographie ---
    age: str = Field(..., description="Tranche d'âge, ex: '[60-70)'",
                     examples=["[60-70)"])
    gender: str = Field("Female", description="Female ou Male")
    race: str = Field("Caucasian", description="Origine ethnique")

    # --- Admission / séjour ---
    admission_type_id: str = Field("1", description="Type d'admission (code)")
    discharge_disposition_id: str = Field("1", description="Destination de sortie (code)")
    admission_source_id: str = Field("1", description="Source d'admission (code)")
    time_in_hospital: int = Field(..., ge=1, le=14, description="Durée du séjour (jours)")
    medical_specialty: str = Field("Missing", description="Spécialité médicale")

    # --- Procédures / médicaments ---
    num_lab_procedures: int = Field(..., ge=0, description="Nb d'analyses labo")
    num_procedures: int = Field(0, ge=0, description="Nb de procédures")
    num_medications: int = Field(..., ge=0, description="Nb de médicaments")

    # --- Historique de visites ---
    number_outpatient: int = Field(0, ge=0)
    number_emergency: int = Field(0, ge=0)
    number_inpatient: int = Field(0, ge=0)
    number_diagnoses: int = Field(..., ge=1, description="Nb de diagnostics")

    # --- Diagnostics (codes ICD-9 bruts) ---
    diag_1: str = Field(..., description="Diagnostic principal (code ICD-9)")
    diag_2: str = Field("Autre", description="Diagnostic secondaire")
    diag_3: str = Field("Autre", description="Diagnostic tertiaire")

    # --- Tests (None = non mesuré) ---
    A1Cresult: Optional[str] = Field(None, description="Norm, >7, >8 ou None")
    max_glu_serum: Optional[str] = Field(None, description="Norm, >200, >300 ou None")

    # --- Traitement ---
    change: str = Field("No", description="Changement de traitement : No ou Ch")
    diabetesMed: str = Field("Yes", description="Médicament diabète : Yes ou No")

    # --- Médicaments (optionnels, défaut 'No') ---
    metformin: Optional[str] = "No"
    insulin: Optional[str] = "No"
    glipizide: Optional[str] = "No"
    glyburide: Optional[str] = "No"
    pioglitazone: Optional[str] = "No"
    rosiglitazone: Optional[str] = "No"
    glimepiride: Optional[str] = "No"
    # (les autres médicaments prennent 'No' par défaut dans le pipeline)

    model_config = {
        "json_schema_extra": {
            "example": {
                "age": "[60-70)", "gender": "Male", "race": "Caucasian",
                "admission_type_id": "1", "discharge_disposition_id": "1",
                "admission_source_id": "7", "time_in_hospital": 5,
                "medical_specialty": "InternalMedicine",
                "num_lab_procedures": 45, "num_procedures": 1,
                "num_medications": 18, "number_outpatient": 0,
                "number_emergency": 0, "number_inpatient": 1,
                "number_diagnoses": 9, "diag_1": "250.4", "diag_2": "401",
                "diag_3": "414", "A1Cresult": ">8", "max_glu_serum": None,
                "change": "Ch", "diabetesMed": "Yes", "insulin": "Steady",
            }
        }
    }


# =============================================================
# SORTIE — résultat de prédiction
# =============================================================

class FacteurSHAP(BaseModel):
    """Un facteur explicatif (feature + contribution)."""
    feature: str
    contribution: float
    sens: str  # "augmente" ou "diminue"


class PredictionOutput(BaseModel):
    """Résultat complet d'une prédiction."""
    probabilite: float = Field(..., description="Probabilité de réadmission (0-1)")
    seuil: float = Field(..., description="Seuil de décision utilisé")
    a_risque: bool = Field(..., description="Patient classé à risque ?")
    niveau_risque: str = Field(..., description="Faible / Modéré / Élevé / Très élevé")
    recommandation: str
    facteurs: list[FacteurSHAP] = Field(default_factory=list)