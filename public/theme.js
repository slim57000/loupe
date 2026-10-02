// Applique le thème enregistré avant le premier rendu, pour eviter le clignotement.
// Ce fichier est charge de maniere bloquante dans <head> : il doit rester independant
// et ne dependre d'aucun module.
(function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('loupe.theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
    }
  } catch (error) {
    // Stockage indisponible : on conserve le theme du systeme.
  }
})();