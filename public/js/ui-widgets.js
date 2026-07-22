(function() {
    'use strict';

    function wireProWarningToggle() {
        var modelSelect = document.getElementById('geminiModel');
        var warningDiv = document.getElementById('proRateLimitWarning');
        if (!modelSelect || !warningDiv) return;

        function updateWarning() {
            const model = String(modelSelect.value || '');
            warningDiv.style.display = (model === 'gemini-2.5-pro' || model.includes('-pro-preview')) ? 'block' : 'none';
        }

        modelSelect.addEventListener('change', updateWarning);
        updateWarning();
    }

    function initWidgets() {
        wireProWarningToggle();
    }

    (window.partialsReady || Promise.resolve()).then(initWidgets).catch(function(err) {
        console.error(err);
    });
})();
