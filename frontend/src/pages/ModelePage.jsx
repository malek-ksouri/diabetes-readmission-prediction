import { useState, useEffect } from "react";
import { TrendingDown, Link2, Clock, Building2, Stethoscope } from "lucide-react";
import { getShapGlobal } from "../api";

// Traduction des noms techniques de features en libellés cliniques lisibles.
const LIBELLES_SHAP = {
  "discharge_disposition_id_1": "Sortie à domicile",
  "discharge_disposition_id_6": "Sortie à domicile avec soins",
  "discharge_disposition_id_22": "Transfert en réadaptation",
  "discharge_disposition_id_3": "Transfert en établissement",
  "time_in_hospital": "Durée du séjour",
  "number_inpatient": "Hospitalisations antérieures",
  "number_emergency": "Passages aux urgences",
  "number_outpatient": "Consultations externes",
  "score_risque_hospitalier": "Score de risque hospitalier",
  "diabetesMed": "Sous traitement diabète",
  "num_lab_procedures": "Analyses de laboratoire",
  "age_numeric": "Âge",
  "age_group": "Groupe d'âge",
  "num_medications": "Nombre de médicaments",
  "num_procedures": "Procédures médicales",
  "number_diagnoses": "Nombre de diagnostics",
  "metformin": "Metformine",
  "insulin": "Insuline",
  "ratio_medicaments_procedures": "Ratio médicaments / procédures",
  "diag_1_Circulatoire": "Diagnostic principal : circulatoire",
  "diag_1_Respiratoire": "Diagnostic principal : respiratoire",
  "diag_1_Diabete": "Diagnostic principal : diabète",
  "diag_2_Diabete": "Diagnostic secondaire : diabète",
  "diag_2_Respiratoire": "Diagnostic secondaire : respiratoire",
  "diag_2_Circulatoire": "Diagnostic secondaire : circulatoire",
  "medical_specialty_Cardiology": "Spécialité : cardiologie",
  "medical_specialty_InternalMedicine": "Spécialité : médecine interne",
  "change": "Changement de traitement",
  "patient_complexe": "Patient complexe",
};

function libelleShap(feature) {
  // Retire les préfixes num__ / cat__ du preprocessor
  const nom = feature.replace(/^(num__|cat__)/, "");
  return LIBELLES_SHAP[nom] || nom;
}

// URL de l'image SHAP summary (servie par le frontend depuis public/)
const SHAP_SUMMARY_IMG = "/shap_summary.png";

function ModelePage() {
  const [shap, setShap] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [imgErreur, setImgErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    getShapGlobal()
      .then((d) => { if (actif) setShap(d); })
      .catch(() => { if (actif) setErreur("Impossible de charger les données SHAP. Vérifie que l'API tourne et que shap_importance.json existe."); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  const features = shap?.features || [];
  const maxImp = features.length ? Math.max(...features.map((f) => f.importance)) : 1;

  return (
    <>
      <div className="page-entete">
        <h1>Comprendre le modèle</h1>
        <p>Quels facteurs pèsent le plus dans les prédictions, à l'échelle de la cohorte</p>
      </div>

      {/* Explication pédagogique */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Comment le modèle décide</h2>
        <p className="perf-texte">
          Ce classement montre l'<strong>importance globale</strong> de chaque facteur,
          mesurée par la méthode SHAP sur le jeu de test. Plus la barre est longue, plus
          le facteur influence les prédictions du modèle — toutes situations confondues.
        </p>
        <p className="perf-texte" style={{ marginBottom: 0 }}>
          Contrairement aux facteurs affichés pour un patient précis, cette vue est
          <strong> globale</strong> : elle décrit le comportement d'ensemble du modèle,
          pas un cas particulier.
        </p>
      </div>

      {/* Fiche d'identité du modèle */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Fiche d'identité du modèle</h2>
        <div className="fiche-modele">
          <div className="fiche-item">
            <span className="fiche-cle">Algorithme</span>
            <span className="fiche-val">LightGBM (gradient boosting)</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Calibration</span>
            <span className="fiche-val">Platt (sigmoïde)</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Optimisation</span>
            <span className="fiche-val">Optuna (150 essais, CV 5-fold)</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Nombre de variables</span>
            <span className="fiche-val">186 features</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Seuil de décision</span>
            <span className="fiche-val">0,38 (F2-optimal)</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Cible prédite</span>
            <span className="fiche-val">Réadmission &lt; 30 jours</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Population</span>
            <span className="fiche-val">69 987 séjours diabétiques</span>
          </div>
          <div className="fiche-item">
            <span className="fiche-cle">Explicabilité</span>
            <span className="fiche-val">SHAP (TreeExplainer)</span>
          </div>
        </div>
      </div>

      {/* Barres d'importance */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Importance des facteurs (SHAP)</h2>
        {chargement ? (
          <p className="placeholder">Chargement des données SHAP…</p>
        ) : erreur ? (
          <p className="erreur">{erreur}</p>
        ) : (
          <div className="barres-metriques">
            {features.map((f, i) => (
              <div className="barre-metrique-ligne" key={i}>
                <div className="barre-metrique-haut">
                  <span className="barre-metrique-nom">{libelleShap(f.feature)}</span>
                  <span className="barre-metrique-val">{f.importance.toFixed(3)}</span>
                </div>
                <div className="barre-metrique-piste">
                  <div className="barre-metrique-remplissage"
                    style={{ width: `${(f.importance / maxImp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Figure SHAP summary (PNG du NB07) en complément */}
      {!imgErreur && (
        <div className="carte">
          <h2>Vue détaillée (SHAP summary)</h2>
          <p className="perf-texte">
            Chaque point est un patient. Sa position indique l'effet du facteur sur le
            risque (droite = augmente, gauche = diminue), et sa couleur la valeur du
            facteur (rouge = élevée, bleu = basse).
          </p>
          <div className="shap-img-conteneur">
            <img src={SHAP_SUMMARY_IMG} alt="SHAP summary plot"
              className="shap-img" onError={() => setImgErreur(true)} />
          </div>
        </div>
      )}
      {/* Section limites du modèle */}
      <div className="carte" style={{ marginTop: "1.4rem" }}>
        <h2>Limites du modèle</h2>
        <p className="perf-texte">
          Par transparence, voici ce que ce modèle ne fait pas — des limites assumées,
          importantes pour un usage clinique éclairé.
        </p>
        <div className="limites-liste">
          <div className="limite-item">
            <span className="limite-icone"><TrendingDown size={16} strokeWidth={1.8} /></span>
            <div>
              <strong>Pouvoir prédictif modeste.</strong> Le signal dans les données est
              intrinsèquement faible : prédire une réadmission reste difficile. Les scores
              sont donc prudents, ce qui est cohérent avec la littérature sur ce jeu de données.
            </div>
          </div>
          <div className="limite-item">
            <span className="limite-icone"><Link2 size={16} strokeWidth={1.8} /></span>
            <div>
              <strong>Corrélation, pas causalité.</strong> Le modèle identifie des
              associations statistiques. Il ne dit pas qu'agir sur un facteur
              <em> causera</em> une baisse du risque.
            </div>
          </div>
          <div className="limite-item">
            <span className="limite-icone"><Clock size={16} strokeWidth={1.8} /></span>
            <div>
              <strong>Pas de suivi temporel.</strong> Chaque patient est évalué sur un seul
              séjour (le premier), pour éviter tout biais entre séjours d'un même patient.
              Le modèle ne suit pas l'évolution dans le temps.
            </div>
          </div>
          <div className="limite-item">
            <span className="limite-icone"><Building2 size={16} strokeWidth={1.8} /></span>
            <div>
              <strong>Données historiques et spécifiques.</strong> Le modèle a appris sur des
              hôpitaux américains (1999-2008). Son transfert à d'autres contextes de soins
              n'est pas garanti sans réévaluation.
            </div>
          </div>
          <div className="limite-item">
            <span className="limite-icone"><Stethoscope size={16} strokeWidth={1.8} /></span>
            <div>
              <strong>Aide à la décision, pas décision.</strong> Cet outil éclaire le
              jugement clinique, il ne le remplace pas. La décision finale revient toujours
              au professionnel de santé.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ModelePage;