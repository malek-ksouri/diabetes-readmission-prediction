import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import PerformancePage from "./pages/PerformancePage";
import ModelePage from "./pages/ModelePage";
import AProposPage from "./pages/AProposPage";
import BatchPage from "./pages/BatchPage";
import "./App.css";

// App = ossature : sidebar fixe à gauche + zone de contenu routée à droite.
// Le thème (clair/sombre) est géré ici. La classe "dark" est posée sur <body>
// pour que le fond couvre tout l'écran, pas seulement la zone de contenu.

function App() {
  const [sombre, setSombre] = useState(false);

  // Applique/retire la classe "dark" sur le body selon le thème
  useEffect(() => {
    if (sombre) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [sombre]);

  return (
    <BrowserRouter>
      <div className={"app-layout" + (sombre ? " dark" : "")}>
        <Sidebar sombre={sombre} onToggleTheme={() => setSombre((s) => !s)} />
        <main className="contenu-principal">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/analyse-lot" element={<BatchPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/comprendre-modele" element={<ModelePage />} />
            <Route path="/a-propos" element={<AProposPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;