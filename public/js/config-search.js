(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SubMakerConfigSearch = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function normalizeSearchText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    function tokenizeQuery(query) {
        return [...new Set(normalizeSearchText(query).split(/\s+/).filter(Boolean))].slice(0, 8);
    }

    function matchesSearchText(text, query) {
        const tokens = Array.isArray(query) ? query : tokenizeQuery(query);
        if (!tokens.length) return true;
        const haystack = normalizeSearchText(text);
        return tokens.every(token => haystack.includes(token));
    }

    function initConfigSearch(doc) {
        if (!doc || doc.__submakerConfigSearchReady) return;
        const input = doc.getElementById('configSearchInput');
        const clearButton = doc.getElementById('configSearchClear');
        const resultNode = doc.getElementById('configSearchResults');
        const emptyNode = doc.getElementById('configSearchEmpty');
        if (!input || !clearButton || !resultNode) return;
        doc.__submakerConfigSearchReady = true;

        const cards = Array.from(doc.querySelectorAll('#configForm .card'));
        const sections = Array.from(doc.querySelectorAll('#configForm .section-block'));
        let originalCollapsed = new WeakMap();

        function translate(key, vars, fallback) {
            try { return typeof window.t === 'function' ? window.t(key, vars || {}, fallback) : fallback; }
            catch (_) { return fallback; }
        }

        function searchableText(element) {
            return [
                element.textContent || '',
                element.getAttribute('data-card') || '',
                element.getAttribute('id') || '',
                element.getAttribute('data-search-keywords') || ''
            ].join(' ');
        }

        function rememberState(element) {
            if (!originalCollapsed.has(element)) originalCollapsed.set(element, element.classList.contains('collapsed'));
        }

        function restore() {
            cards.forEach(card => {
                card.classList.remove('config-search-hidden', 'config-search-match');
                if (originalCollapsed.has(card)) card.classList.toggle('collapsed', originalCollapsed.get(card));
            });
            sections.forEach(section => {
                section.classList.remove('config-search-hidden', 'config-search-match');
                if (originalCollapsed.has(section)) section.classList.toggle('collapsed', originalCollapsed.get(section));
            });
            originalCollapsed = new WeakMap();
            resultNode.textContent = translate('config.search.ready', {}, 'Search settings, providers and features');
            if (emptyNode) emptyNode.hidden = true;
            clearButton.hidden = true;
        }

        function applySearch() {
            const tokens = tokenizeQuery(input.value);
            if (!tokens.length) {
                restore();
                return;
            }

            let matches = 0;
            cards.forEach(card => {
                rememberState(card);
                const matched = matchesSearchText(searchableText(card), tokens);
                card.classList.toggle('config-search-hidden', !matched);
                card.classList.toggle('config-search-match', matched);
                if (matched) {
                    card.classList.remove('collapsed');
                    matches += 1;
                }
            });

            sections.forEach(section => {
                rememberState(section);
                const childCards = Array.from(section.querySelectorAll(':scope > .section-grid > .card, :scope > .card'));
                const sectionOwnMatch = matchesSearchText(
                    Array.from(section.children)
                        .filter(child => child.classList?.contains('section-header'))
                        .map(child => child.textContent || '')
                        .join(' '),
                    tokens
                );
                const hasVisibleCard = childCards.some(card => !card.classList.contains('config-search-hidden'));
                const visible = sectionOwnMatch || hasVisibleCard || (childCards.length === 0 && matchesSearchText(searchableText(section), tokens));
                section.classList.toggle('config-search-hidden', !visible);
                section.classList.toggle('config-search-match', visible);
                if (visible) section.classList.remove('collapsed');
            });

            clearButton.hidden = false;
            resultNode.textContent = matches === 1
                ? translate('config.search.oneResult', {}, '1 matching settings card')
                : translate('config.search.results', { count: matches }, '{count} matching settings cards').replace('{count}', String(matches));
            if (emptyNode) emptyNode.hidden = matches > 0;
        }

        let frame = 0;
        function scheduleSearch() {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                applySearch();
            });
        }

        input.addEventListener('input', scheduleSearch);
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                input.value = '';
                applySearch();
                input.blur();
            }
        });
        clearButton.addEventListener('click', () => {
            input.value = '';
            applySearch();
            input.focus();
        });
        doc.addEventListener('keydown', event => {
            const target = event.target;
            const editing = target && (target.matches?.('input,textarea,select') || target.isContentEditable);
            if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
                event.preventDefault(); input.focus(); input.select();
            } else if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault(); input.focus();
            }
        });
        if (typeof window !== 'undefined') {
            window.addEventListener('submaker:locale-updated', scheduleSearch);
        }
        applySearch();
    }

    function autoInit() {
        if (typeof document === 'undefined') return;
        const ready = (typeof window !== 'undefined' && (window.mainPartialReady || window.partialsReady)) || Promise.resolve();
        Promise.resolve(ready).catch(function () {}).then(function () { initConfigSearch(document); });
    }

    autoInit();
    return { normalizeSearchText, tokenizeQuery, matchesSearchText, initConfigSearch };
}));
