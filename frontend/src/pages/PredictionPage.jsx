import { useState } from "react";
import { AlertTriangle, FileDown } from "lucide-react";
import { predirePatient, telechargerRapportPDF } from "../api";

const PATIENT_EXEMPLE = {
  age: "[60-70)", gender: "Male", race: "Caucasian",
  admission_type_id: "1", discharge_disposition_id: "1", admission_source_id: "7",
  time_in_hospital: 5, medical_specialty: "InternalMedicine",
  num_lab_procedures: 45, num_procedures: 1, num_medications: 18,
  number_outpatient: 0, number_emergency: 0, number_inpatient: 1,
  number_diagnoses: 9, diag_1: "250.4", diag_2: "401", diag_3: "414",
  A1Cresult: ">8", max_glu_serum: null,
  change: "Ch", diabetesMed: "Yes", insulin: "Steady", metformin: "No",
};

const LIBELLES = {
  number_inpatient: "Hospitalisations antérieures",
  number_emergency: "Passages aux urgences",
  number_outpatient: "Consultations externes",
  time_in_hospital: "Durée du séjour",
  num_medications: "Nombre de médicaments",
  num_lab_procedures: "Analyses de laboratoire",
  num_procedures: "Procédures médicales",
  number_diagnoses: "Nombre de diagnostics",
  score_risque_hospitalier: "Score de risque hospitalier",
  age_numeric: "Âge",
  age_group: "Groupe d'âge",
  diabetesMed: "Traitement diabète",
  A1Cresult: "Résultat A1c",
  A1C_mesure: "Test A1c effectué",
  glucose_mesure: "Test glucose effectué",
  ratio_medicaments_procedures: "Ratio médicaments/procédures",
  patient_complexe: "Patient complexe",
  insulin: "Insuline",
  metformin: "Metformine",
  change: "Changement de traitement",
  gender: "Sexe",
  discharge_disposition_id_1: "Sortie à domicile",
  diag_1_Diabete: "Diagnostic : Diabète",
  diag_1_Circulatoire: "Diagnostic : Circulatoire",
  diag_1_Respiratoire: "Diagnostic : Respiratoire",
};

function libelle(feature) {
  const nom = feature.replace(/^(num__|cat__)/, "");
  return LIBELLES[nom] || nom;
}

function Section({ titre, ouvert, onToggle, children }) {
  return (
    <div className="section">
      <button className="section-titre" onClick={onToggle}>
        <span>{titre}</span>
        <span className="chevron">{ouvert ? "▲" : "▼"}</span>
      </button>
      {ouvert && <div className="section-contenu">{children}</div>}
    </div>
  );
}

function PredictionPage() {
  const [patient, setPatient] = useState({ ...PATIENT_EXEMPLE });
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [sections, setSections] = useState({
    demo: true, sejour: false, historique: false, diagnostics: false, traitement: false,
  });
  // États du simulateur what-if
  const [simulation, setSimulation] = useState(null);
  const [resultatSim, setResultatSim] = useState(null);
  const [chargementSim, setChargementSim] = useState(false);
  // État de génération du rapport PDF
  const [chargementPdf, setChargementPdf] = useState(false);

  const majChamp = (champ, valeur) => setPatient({ ...patient, [champ]: valeur });
  const toggleSection = (s) => setSections({ ...sections, [s]: !sections[s] });

  const predire = async () => {
    setChargement(true); setErreur(null); setResultat(null);
    setSimulation(null); setResultatSim(null); // reset du what-if
    try {
      const donnees = await predirePatient(patient);
      setResultat(donnees);
      // Le what-if part d'une copie des 6 leviers du patient réel
      setSimulation({
        num_medications: patient.num_medications,
        time_in_hospital: patient.time_in_hospital,
        number_inpatient: patient.number_inpatient,
        number_emergency: patient.number_emergency,
        change: patient.change,
        insulin: patient.insulin,
      });
    } catch (e) {
      setErreur("Impossible de contacter l'API. Vérifie qu'elle tourne (uvicorn).");
    } finally {
      setChargement(false);
    }
  };

  // --- Simulateur what-if ---
  const majSimulation = (champ, valeur) =>
    setSimulation({ ...simulation, [champ]: valeur });

  const recalculerSimulation = async () => {
    if (!simulation) return;
    setChargementSim(true); setResultatSim(null);
    try {
      // On repart du patient réel, en remplaçant seulement les 4 leviers simulés
      const patientSimule = { ...patient, ...simulation };
      const donnees = await predirePatient(patientSimule);
      setResultatSim(donnees);
    } catch (e) {
      setResultatSim({ erreur: true });
    } finally {
      setChargementSim(false);
    }
  };

  const genererPdf = async () => {
    if (!resultat) return;
    setChargementPdf(true);
    try {
      await telechargerRapportPDF(patient);
    } catch (e) {
      setErreur("Impossible de générer le rapport PDF. Vérifie que l'API tourne.");
    } finally {
      setChargementPdf(false);
    }
  };

  const couleurRisque = (niveau) => {
    if (niveau === "Faible") return "#27AE60";
    if (niveau === "Modéré") return "#F39C12";
    if (niveau === "Élevé") return "#E67E22";
    return "#E74C3C";
  };

  const proba = resultat ? resultat.probabilite : 0;
  const rayon = 80;
  const circonference = 2 * Math.PI * rayon;
  const remplissage = circonference * (1 - proba);

  // Mode urgence : déclenché quand le niveau de risque est "Très élevé".
  const modeUrgence = resultat && resultat.niveau_risque === "Très élevé";

  return (
    <>
      {/* Mode urgence : pulsation rouge sur toute la page (n'intercepte pas les clics) */}
      {modeUrgence && <div className="urgence-overlay" aria-hidden="true" />}

      <div className="page-entete">
        <h1>Prédiction individuelle</h1>
        <p>Évaluation du risque de réadmission précoce (&lt; 30 jours) pour un patient</p>
      </div>

      {modeUrgence && (
        <div className="urgence-bandeau">
          <span className="urgence-icone"><AlertTriangle size={16} strokeWidth={2} /></span>
          <span>
            <strong>Patient à risque très élevé.</strong> Vigilance renforcée recommandée —
            à évaluer en priorité.
          </span>
        </div>
      )}

      <div className="contenu">
      <div className="carte formulaire">
        <div className="formulaire-entete">
          <h2>Données du patient</h2>
          <button className="bouton-exemple" onClick={() => setPatient({ ...PATIENT_EXEMPLE })}>
            Charger un exemple
          </button>
        </div>

        <Section titre="Démographie" ouvert={sections.demo} onToggle={() => toggleSection("demo")}>
          <div className="grille">
            <div className="champ">
              <label>Âge</label>
              <select value={patient.age} onChange={(e) => majChamp("age", e.target.value)}>
                {["[0-10)","[10-20)","[20-30)","[30-40)","[40-50)","[50-60)","[60-70)","[70-80)","[80-90)","[90-100)"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="champ">
              <label>Sexe</label>
              <select value={patient.gender} onChange={(e) => majChamp("gender", e.target.value)}>
                <option value="Male">Homme</option>
                <option value="Female">Femme</option>
              </select>
            </div>
            <div className="champ">
              <label>Origine</label>
              <select value={patient.race} onChange={(e) => majChamp("race", e.target.value)}>
                <option value="Caucasian">Caucasien</option>
                <option value="AfricanAmerican">Afro-américain</option>
                <option value="Hispanic">Hispanique</option>
                <option value="Asian">Asiatique</option>
                <option value="Other">Autre</option>
              </select>
            </div>
          </div>
        </Section>

        <Section titre="Séjour hospitalier" ouvert={sections.sejour} onToggle={() => toggleSection("sejour")}>
          <div className="grille">
            <div className="champ">
              <label>Durée du séjour (jours)</label>
              <input type="number" min="1" max="14" value={patient.time_in_hospital}
                onChange={(e) => majChamp("time_in_hospital", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Analyses labo</label>
              <input type="number" min="0" value={patient.num_lab_procedures}
                onChange={(e) => majChamp("num_lab_procedures", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Procédures</label>
              <input type="number" min="0" value={patient.num_procedures}
                onChange={(e) => majChamp("num_procedures", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Nb de médicaments</label>
              <input type="number" min="0" value={patient.num_medications}
                onChange={(e) => majChamp("num_medications", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Spécialité médicale</label>
              <select value={patient.medical_specialty} onChange={(e) => majChamp("medical_specialty", e.target.value)}>
                <option value="InternalMedicine">Médecine interne</option>
                <option value="Cardiology">Cardiologie</option>
                <option value="Surgery-General">Chirurgie</option>
                <option value="Family/GeneralPractice">Médecine générale</option>
                <option value="Emergency/Trauma">Urgences</option>
                <option value="Missing">Non renseignée</option>
              </select>
            </div>
            <div className="champ">
              <label>Destination de sortie</label>
              <select value={patient.discharge_disposition_id} onChange={(e) => majChamp("discharge_disposition_id", e.target.value)}>
                <option value="1">Domicile</option>
                <option value="3">Transfert établissement</option>
                <option value="6">Domicile + soins</option>
                <option value="2">Autre hôpital</option>
              </select>
            </div>
          </div>
        </Section>

        <Section titre="Historique hospitalier" ouvert={sections.historique} onToggle={() => toggleSection("historique")}>
          <div className="grille">
            <div className="champ">
              <label>Hospitalisations antérieures</label>
              <input type="number" min="0" value={patient.number_inpatient}
                onChange={(e) => majChamp("number_inpatient", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Passages aux urgences</label>
              <input type="number" min="0" value={patient.number_emergency}
                onChange={(e) => majChamp("number_emergency", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Consultations externes</label>
              <input type="number" min="0" value={patient.number_outpatient}
                onChange={(e) => majChamp("number_outpatient", parseInt(e.target.value))} />
            </div>
            <div className="champ">
              <label>Nb de diagnostics</label>
              <input type="number" min="1" value={patient.number_diagnoses}
                onChange={(e) => majChamp("number_diagnoses", parseInt(e.target.value))} />
            </div>
          </div>
        </Section>

        <Section titre="Diagnostics (ICD-9)" ouvert={sections.diagnostics} onToggle={() => toggleSection("diagnostics")}>
          <div className="grille">
            <div className="champ">
              <label>Diagnostic principal</label>
              <input type="text" value={patient.diag_1} onChange={(e) => majChamp("diag_1", e.target.value)} />
            </div>
            <div className="champ">
              <label>Diagnostic secondaire</label>
              <input type="text" value={patient.diag_2} onChange={(e) => majChamp("diag_2", e.target.value)} />
            </div>
            <div className="champ">
              <label>Diagnostic tertiaire</label>
              <input type="text" value={patient.diag_3} onChange={(e) => majChamp("diag_3", e.target.value)} />
            </div>
            <div className="champ">
              <label>Test A1c</label>
              <select value={patient.A1Cresult || ""} onChange={(e) => majChamp("A1Cresult", e.target.value || null)}>
                <option value="">Non mesuré</option>
                <option value="Norm">Normal</option>
                <option value=">7">&gt;7</option>
                <option value=">8">&gt;8</option>
              </select>
            </div>
          </div>
        </Section>

        <Section titre="Traitement" ouvert={sections.traitement} onToggle={() => toggleSection("traitement")}>
          <div className="grille">
            <div className="champ">
              <label>Insuline</label>
              <select value={patient.insulin} onChange={(e) => majChamp("insulin", e.target.value)}>
                <option value="No">Non</option>
                <option value="Steady">Stable</option>
                <option value="Up">Augmentée</option>
                <option value="Down">Diminuée</option>
              </select>
            </div>
            <div className="champ">
              <label>Metformine</label>
              <select value={patient.metformin} onChange={(e) => majChamp("metformin", e.target.value)}>
                <option value="No">Non</option>
                <option value="Steady">Stable</option>
                <option value="Up">Augmentée</option>
                <option value="Down">Diminuée</option>
              </select>
            </div>
            <div className="champ">
              <label>Sous médicament diabète</label>
              <select value={patient.diabetesMed} onChange={(e) => majChamp("diabetesMed", e.target.value)}>
                <option value="Yes">Oui</option>
                <option value="No">Non</option>
              </select>
            </div>
            <div className="champ">
              <label>Changement de traitement</label>
              <select value={patient.change} onChange={(e) => majChamp("change", e.target.value)}>
                <option value="No">Non</option>
                <option value="Ch">Oui</option>
              </select>
            </div>
          </div>
        </Section>

        <button className="bouton" onClick={predire} disabled={chargement}>
          {chargement ? "Analyse en cours..." : "Prédire le risque"}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>

      <div className="carte resultat">
        <h2>Résultat de l'évaluation</h2>
        {!resultat && !chargement && (
          <p className="placeholder">Remplis le formulaire et clique sur « Prédire le risque » pour obtenir une évaluation.</p>
        )}
        {resultat && (
          <>
            <div className="jauge-svg-conteneur">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r={rayon} fill="none" stroke="#eaeded" strokeWidth="16" />
                <circle cx="100" cy="100" r={rayon} fill="none"
                  stroke={couleurRisque(resultat.niveau_risque)} strokeWidth="16"
                  strokeDasharray={circonference} strokeDashoffset={remplissage}
                  strokeLinecap="round" transform="rotate(-90 100 100)"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                <text x="100" y="95" textAnchor="middle" fontSize="36" fontWeight="700"
                  fill={couleurRisque(resultat.niveau_risque)}>
                  {(resultat.probabilite * 100).toFixed(1)}%
                </text>
                <text x="100" y="120" textAnchor="middle" fontSize="12" fill="#7f8c8d">
                  risque
                </text>
              </svg>
            </div>

            <div className="badge" style={{ background: couleurRisque(resultat.niveau_risque) }}>
              {resultat.a_risque ? "À risque" : "Risque faible"} — {resultat.niveau_risque}
            </div>

            <p className="seuil-info">Seuil de décision : {(resultat.seuil * 100).toFixed(0)}%</p>
            <p className="recommandation">{resultat.recommandation}</p>

            <h3>Facteurs déterminants</h3>
            <div className="facteurs">
              {resultat.facteurs.map((f, i) => (
                <div key={i} className="facteur">
                  <span className="fleche" style={{ color: f.sens === "augmente" ? "#E74C3C" : "#27AE60" }}>
                    {f.sens === "augmente" ? "▲" : "▼"}
                  </span>
                  <div className="facteur-noms">
                    <span className="nom-facteur">{libelle(f.feature)}</span>
                    <span className="nom-technique">{f.feature.replace(/^(num__|cat__)/, "")}</span>
                  </div>
                  <div className="barre-conteneur">
                    <div className="barre" style={{
                      width: Math.min(Math.abs(f.contribution) * 200, 100) + "%",
                      background: f.sens === "augmente" ? "#E74C3C" : "#27AE60",
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Le simulateur what-if est placé plus bas, en pleine largeur */}

            <button className="bouton-pdf" onClick={genererPdf} disabled={chargementPdf}>
              <FileDown size={16} strokeWidth={1.8} />
              {chargementPdf ? "Génération…" : "Générer le rapport PDF"}
            </button>

            <p className="avertissement">
              Outil d'aide à la décision. Ne remplace pas le jugement clinique.
            </p>
          </>
        )}
      </div>
      </div>

      {/* ===== SIMULATEUR WHAT-IF (pleine largeur, sous les 2 colonnes) ===== */}
      {resultat && simulation && (
        <div className="whatif whatif-pleine">
          <h3>Simulateur « et si… ? »</h3>
          <p className="whatif-intro">
            Ajustez quelques facteurs et recalculez pour explorer leur effet
            sur le risque estimé.
          </p>

          <div className="whatif-leviers">
            <div className="champ">
              <label>Nombre de médicaments</label>
              <input type="number" min="0" value={simulation.num_medications}
                onChange={(e) => majSimulation("num_medications", parseInt(e.target.value) || 0)} />
            </div>
            <div className="champ">
              <label>Durée du séjour (jours)</label>
              <input type="number" min="1" max="14" value={simulation.time_in_hospital}
                onChange={(e) => majSimulation("time_in_hospital", parseInt(e.target.value) || 1)} />
            </div>
            <div className="champ">
              <label>Hospitalisations antérieures</label>
              <input type="number" min="0" value={simulation.number_inpatient}
                onChange={(e) => majSimulation("number_inpatient", parseInt(e.target.value) || 0)} />
            </div>
            <div className="champ">
              <label>Passages aux urgences</label>
              <input type="number" min="0" value={simulation.number_emergency}
                onChange={(e) => majSimulation("number_emergency", parseInt(e.target.value) || 0)} />
            </div>
            <div className="champ">
              <label>Changement de traitement</label>
              <select value={simulation.change}
                onChange={(e) => majSimulation("change", e.target.value)}>
                <option value="No">Non</option>
                <option value="Ch">Oui</option>
              </select>
            </div>
            <div className="champ">
              <label>Insuline</label>
              <select value={simulation.insulin}
                onChange={(e) => majSimulation("insulin", e.target.value)}>
                <option value="No">Non</option>
                <option value="Steady">Stable</option>
                <option value="Up">Augmentée</option>
                <option value="Down">Diminuée</option>
              </select>
            </div>
          </div>

          <button className="bouton whatif-bouton" onClick={recalculerSimulation} disabled={chargementSim}>
            {chargementSim ? "Recalcul…" : "Recalculer le risque"}
          </button>

          {resultatSim && !resultatSim.erreur && (
            <div className="whatif-comparaison">
              <div className="whatif-col">
                <span className="whatif-label">Risque initial</span>
                <span className="whatif-proba" style={{ color: couleurRisque(resultat.niveau_risque) }}>
                  {(resultat.probabilite * 100).toFixed(1)}%
                </span>
              </div>
              <div className="whatif-fleche-comp">→</div>
              <div className="whatif-col">
                <span className="whatif-label">Risque simulé</span>
                <span className="whatif-proba" style={{ color: couleurRisque(resultatSim.niveau_risque) }}>
                  {(resultatSim.probabilite * 100).toFixed(1)}%
                </span>
              </div>
              <div className="whatif-delta">
                {(() => {
                  const delta = (resultatSim.probabilite - resultat.probabilite) * 100;
                  const signe = delta > 0 ? "+" : "";
                  const couleur = delta > 0 ? "#E74C3C" : delta < 0 ? "#27AE60" : "#95a5a6";
                  return <span style={{ color: couleur }}>{signe}{delta.toFixed(1)} pts</span>;
                })()}
              </div>
            </div>
          )}
          {resultatSim && resultatSim.erreur && (
            <p className="erreur">Recalcul impossible. Vérifie que l'API tourne.</p>
          )}

          <p className="whatif-avert">
            Simulation exploratoire fondée sur des corrélations, non sur une
            relation de cause à effet. À interpréter avec prudence clinique.
          </p>
        </div>
      )}
    </>
  );
}

export default PredictionPage;