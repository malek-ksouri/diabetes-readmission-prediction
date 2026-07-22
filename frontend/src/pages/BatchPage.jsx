import { useState } from "react";
import { Download } from "lucide-react";
import { analyserLot } from "../api";

// Couleur associée au niveau de risque (même logique que la page prédiction).
function couleurRisque(niveau) {
  if (niveau === "Faible") return "#27AE60";
  if (niveau === "Modéré") return "#F39C12";
  if (niveau === "Élevé") return "#E67E22";
  return "#E74C3C";
}

function BatchPage() {
  const [fichier, setFichier] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  const choisirFichier = (e) => {
    setFichier(e.target.files[0] || null);
    setResultat(null);
    setErreur(null);
  };

  const lancer = async () => {
    if (!fichier) return;
    setChargement(true);
    setErreur(null);
    setResultat(null);
    try {
      const donnees = await analyserLot(fichier);
      setResultat(donnees);
    } catch (e) {
      setErreur(e.message || "Impossible d'analyser le fichier. Vérifie que l'API tourne (uvicorn).");
    } finally {
      setChargement(false);
    }
  };

  // Export CSV des résultats triés par risque (côté navigateur, pas d'API).
  const exporterCSV = () => {
    if (!resultat || !resultat.resultats.length) return;

    // En-têtes + lignes
    const entetes = ["rang", "patient_index", "probabilite", "niveau_risque", "a_risque"];
    const lignes = resultat.resultats.map((r, i) => [
      i + 1,
      r.index,
      (r.probabilite * 100).toFixed(1) + "%",
      r.niveau_risque,
      r.a_risque ? "Oui" : "Non",
    ]);

    // Construction du contenu CSV (séparateur point-virgule pour Excel FR)
    const contenu = [entetes, ...lignes]
      .map((ligne) => ligne.join(";"))
      .join("\n");

    // BOM UTF-8 pour que les accents s'affichent bien dans Excel
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    lien.href = url;
    lien.download = `analyse_lot_${date}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-entete">
        <h1>Analyse par lot</h1>
        <p>Importe un fichier de patients pour les classer par priorité de suivi</p>
      </div>
      <div className="batch">
      <div className="carte">
        <p className="batch-intro">
          Importe un fichier CSV contenant plusieurs patients (une ligne par patient,
          mêmes colonnes que le formulaire de prédiction). Les patients seront classés
          du risque le plus élevé au plus faible, pour prioriser le suivi.
        </p>

        <div className="batch-controles">
          <label className="batch-fichier">
            <input type="file" accept=".csv" onChange={choisirFichier} />
            <span className="batch-fichier-libelle">
              {fichier ? fichier.name : "Choisir un fichier CSV…"}
            </span>
          </label>

          <button
            className="bouton batch-bouton"
            onClick={lancer}
            disabled={!fichier || chargement}
          >
            {chargement ? "Analyse en cours…" : "Analyser le lot"}
          </button>
        </div>

        {erreur && <p className="erreur">{erreur}</p>}
      </div>

      {resultat && (
        <>
          <div className="carte">
            <div className="batch-resume">
              <div className="batch-stat">
                <span className="batch-stat-valeur">{resultat.total_patients}</span>
                <span className="batch-stat-label">Patients analysés</span>
              </div>
              <div className="batch-stat">
                <span className="batch-stat-valeur" style={{ color: "#E74C3C" }}>
                  {resultat.patients_a_risque}
                </span>
                <span className="batch-stat-label">À risque</span>
              </div>
              <div className="batch-stat">
                <span className="batch-stat-valeur">
                  {resultat.total_patients > 0
                    ? Math.round((resultat.patients_a_risque / resultat.total_patients) * 100)
                    : 0}%
                </span>
                <span className="batch-stat-label">Part à risque</span>
              </div>
            </div>
          </div>

          <div className="carte">
            <div className="carte-entete-lien">
              <h2>Patients par priorité</h2>
              <button className="bouton-export" onClick={exporterCSV}>
                <Download size={15} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Exporter en CSV
              </button>
            </div>
            <div className="batch-liste">
              <div className="batch-ligne batch-entete">
                <span>Rang</span>
                <span>Patient (ligne CSV)</span>
                <span>Risque</span>
                <span>Niveau</span>
                <span>Probabilité</span>
              </div>
              {resultat.resultats.map((r, i) => (
                <div key={i} className="batch-ligne">
                  <span className="batch-rang">{i + 1}</span>
                  <span>#{r.index}</span>
                  <span>
                    {r.a_risque ? (
                      <span className="batch-pastille" style={{ background: "#E74C3C" }}>
                        À risque
                      </span>
                    ) : (
                      <span className="batch-pastille" style={{ background: "#27AE60" }}>
                        Faible
                      </span>
                    )}
                  </span>
                  <span style={{ color: couleurRisque(r.niveau_risque), fontWeight: 600 }}>
                    {r.niveau_risque}
                  </span>
                  <span className="batch-proba">
                    <span className="batch-proba-valeur">
                      {(r.probabilite * 100).toFixed(1)}%
                    </span>
                    <span className="batch-barre-conteneur">
                      <span
                        className="batch-barre"
                        style={{
                          width: `${r.probabilite * 100}%`,
                          background: couleurRisque(r.niveau_risque),
                        }}
                      />
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <p className="avertissement">
              ⓘ Outil d'aide à la décision. Ne remplace pas le jugement clinique.
            </p>
          </div>
        </>
      )}
    </div>
    </>
  );
}

export default BatchPage;