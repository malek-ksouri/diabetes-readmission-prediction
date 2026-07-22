import { Link } from "react-router-dom";
import { Stethoscope, Check } from "lucide-react";

// Page À propos : contexte du projet, démarche, sources.
// Reste générale et renvoie vers "Comprendre le modèle" pour le détail technique.

function AProposPage() {
  return (
    <>
      <div className="page-entete">
        <h1>À propos</h1>
        <p>Contexte, démarche et sources de cet outil d'aide à la décision</p>
      </div>

      {/* Le projet */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Le projet</h2>
        <p className="perf-texte">
          Cet outil estime le risque de <strong>réhospitalisation précoce</strong> (moins de
          30 jours) chez des patients diabétiques, à partir des informations de leur séjour.
          Objectif : aider les équipes soignantes à repérer, dès la sortie, les patients qui
          bénéficieraient d'un suivi renforcé.
        </p>
        <p className="perf-texte" style={{ marginBottom: 0 }}>
          Il s'appuie sur le jeu de données <em>Diabetes 130-US Hospitals (1999-2008)</em>,
          soit <strong>69 987 séjours</strong> après nettoyage — une base largement utilisée
          dans la recherche sur la réadmission hospitalière.
        </p>
      </div>

      {/* La démarche */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Une démarche rigoureuse</h2>
        <p className="perf-texte">
          La fiabilité d'un tel outil repose autant sur la méthode que sur le résultat.
          Plusieurs précautions ont guidé sa construction :
        </p>
        <div className="apropos-points">
          <div className="apropos-point">
            <span className="apropos-puce"><Check size={12} strokeWidth={2.5} /></span>
            <div><strong>Prévention des fuites de données.</strong> Un seul séjour par patient
            est retenu, pour éviter que le modèle « triche » en reconnaissant un patient déjà vu.</div>
          </div>
          <div className="apropos-point">
            <span className="apropos-puce"><Check size={12} strokeWidth={2.5} /></span>
            <div><strong>Probabilités calibrées.</strong> Un score de 30 % correspond réellement
            à environ 30 % de risque — les probabilités sont donc directement interprétables.</div>
          </div>
          <div className="apropos-point">
            <span className="apropos-puce"><Check size={12} strokeWidth={2.5} /></span>
            <div><strong>Seuil choisi sur des données dédiées.</strong> Le seuil de décision a été
            fixé sur un jeu de validation, jamais sur les données de test, pour une évaluation honnête.</div>
          </div>
          <div className="apropos-point">
            <span className="apropos-puce"><Check size={12} strokeWidth={2.5} /></span>
            <div><strong>Transparence sur les performances.</strong> Les résultats, modestes mais
            réalistes, sont présentés sans embellissement sur la page Performance.</div>
          </div>
        </div>
        <p className="perf-texte" style={{ marginTop: "1.2rem", marginBottom: 0 }}>
          Pour le détail du fonctionnement du modèle et de ses limites, voir la page{" "}
          <Link to="/comprendre-modele" className="apropos-lien">Comprendre le modèle →</Link>.
        </p>
      </div>

      {/* Avertissement */}
      <div className="carte" style={{ marginBottom: "1.4rem" }}>
        <h2>Usage et responsabilité</h2>
        <div className="apropos-avert">
          <span className="apropos-avert-icone"><Stethoscope size={16} strokeWidth={1.8} /></span>
          <div>
            <strong>Cet outil est une aide à la décision, il ne remplace pas le jugement clinique.</strong>
            {" "}Les prédictions sont des estimations statistiques destinées à éclairer les
            professionnels de santé. La décision finale relève toujours de leur appréciation.
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="carte">
        <h2>Sources</h2>
        <div className="info-liste">
          <div className="info-ligne">
            <span className="info-cle">Jeu de données</span>
            <span className="info-val">Diabetes 130-US Hospitals (1999-2008)</span>
          </div>
          <div className="info-ligne">
            <span className="info-cle">Référence</span>
            <span className="info-val">Strack et al., 2014</span>
          </div>
          <div className="info-ligne">
            <span className="info-cle">Modèle</span>
            <span className="info-val">LightGBM calibré (Platt)</span>
          </div>
          <div className="info-ligne">
            <span className="info-cle">Explicabilité</span>
            <span className="info-val">SHAP</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default AProposPage;