/* External map links only. Does not geocode or change itinerary records. */
(function (root) {
    const text = value => typeof value === 'string' ? value.trim() : '';
    const isKoreanDestination = value => {
        const name = text(value);
        if (/north\s*korea|pyongyang|北韓|北朝鮮|平壤/i.test(name)) return false;
        return /韓國|韩国|南韓|南韩|首爾|首尔|釜山|濟州|济州|仁川|大邱|大田|光州|蔚山|水原|江陵|慶州|庆州|全州|束草|春川|浦項|浦项|麗水|丽水|順天|顺天|木浦|安東|安东|江原|한국|대한민국|서울|부산|제주|인천|대구|대전|광주|울산|수원|강릉|경주|전주|속초|춘천|포항|여수|순천|목포|안동|강원/i.test(name)
            || /^(?:kr|kor)$/i.test(name)
            || /\b(?:korea|southkorea|seoul|busan|pusan|jeju(?:-do)?|incheon|daegu|daejeon|gwangju|ulsan|suwon|gangneung|gyeongju|jeonju|sokcho|chuncheon|pohang|yeosu|suncheon|mokpo|andong|gangwon(?:-do)?)\b/i.test(name);
    };
    const resolveProvider = (settings = {}) => {
        if (settings.mapProvider === 'google' || settings.mapProvider === 'naver') return settings.mapProvider;
        return isKoreanDestination(settings.location) || (!text(settings.location) && isKoreanDestination(settings.name)) ? 'naver' : 'google';
    };
    const providerLabel = provider => provider === 'naver' ? 'NAVER Map' : 'Google Maps';
    const coordinates = (item = {}) => {
        if (item.lat === null || item.lat === undefined || item.lon === null || item.lon === undefined || String(item.lat).trim() === '' || String(item.lon).trim() === '') return null;
        const lat = Number(item.lat), lon = Number(item.lon);
        return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
    };
    const safeNaverUrl = value => {
        try {
            const url = new URL(text(value));
            return url.protocol === 'https:' && ['map.naver.com', 'm.map.naver.com', 'naver.me'].includes(url.hostname) ? url.href : '';
        } catch { return ''; }
    };
    const build = (item = {}, settings = {}, pageUrl = 'https://swes38302-alt.github.io/lisboagogo/') => {
        const provider = resolveProvider(settings), label = providerLabel(provider);
        const point = coordinates(item), name = text(item.location) || text(item.activity);
        const query = item.isManualPin && point ? `${point.lat},${point.lon}` : name || (point ? `${point.lat},${point.lon}` : '');
        if (!query) return { provider, label, href: '#', appUrl: '' };
        if (provider === 'google') return { provider, label, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, appUrl: '' };
        const direct = safeNaverUrl(name);
        if (direct && !item.isManualPin) return { provider, label, href: direct, appUrl: '' };
        let appname;
        try { const url = new URL(pageUrl); appname = url.origin + url.pathname; } catch { appname = 'https://swes38302-alt.github.io/lisboagogo/'; }
        const suffix = `&appname=${encodeURIComponent(appname)}`;
        const appUrl = point && (item.isManualPin || !name)
            ? `nmap://place?lat=${point.lat}&lng=${point.lon}&name=${encodeURIComponent(name || '行程地點')}${suffix}`
            : `nmap://search?query=${encodeURIComponent(query)}${suffix}`;
        return { provider, label, href: `https://map.naver.com/p/search/${encodeURIComponent(query)}`, appUrl };
    };
    const createNavigation = ({ window: win, document: doc, navigator: nav }) => {
        let pending = null;
        const dispose = () => {
            if (!pending) return;
            win.clearTimeout(pending.timer);
            doc.removeEventListener('visibilitychange', pending.cancel);
            win.removeEventListener('pagehide', pending.hide);
            pending = null;
        };
        const handleClick = event => {
            const anchor = event.target?.closest?.('a[data-naver-app]');
            if (!anchor || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            const appUrl = anchor.getAttribute('data-naver-app') || '';
            const webUrl = anchor.href;
            if (!appUrl.startsWith('nmap://') || !/^https:\/\/map\.naver\.com\//.test(webUrl)) return;
            const android = /Android/i.test(nav.userAgent || '');
            const ios = /iPhone|iPad|iPod/i.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
            if (!android && !ios) return; // Desktop, modified clicks and copied links use the web URL.
            event.preventDefault();
            dispose();
            if (android) {
                const intent = appUrl.replace('nmap://', 'intent://') + '#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;S.browser_fallback_url=' + encodeURIComponent(webUrl) + ';end';
                try { win.location.assign(intent); } catch { win.location.assign(webUrl); }
                return;
            }
            const cancel = () => { if (doc.visibilityState === 'hidden') dispose(); };
            const hide = () => dispose();
            pending = { timer: null, cancel, hide };
            doc.addEventListener('visibilitychange', cancel);
            win.addEventListener('pagehide', hide);
            pending.timer = win.setTimeout(() => {
                const visible = doc.visibilityState !== 'hidden';
                dispose();
                if (visible) win.location.assign(webUrl);
            }, 1800);
            try { win.location.assign(appUrl); } catch { dispose(); win.location.assign(webUrl); }
        };
        return { handleClick, dispose };
    };
    root.TripMapLinks = { isKoreanDestination, resolveProvider, providerLabel, coordinates, build, createNavigation };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.TripMapLinks;
})(globalThis);
