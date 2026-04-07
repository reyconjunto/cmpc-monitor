document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:8000/api/news';

    // Elementos da DOM
    const elTotalMentions = document.getElementById('total-mentions');
    const elSourcesCount = document.getElementById('sources-count');
    const elSentiment = document.getElementById('sentiment-dominance');
    const elTrendLabel = document.getElementById('trend-label');
    const elNewsContainer = document.getElementById('news-container');
    const btnRefresh = document.getElementById('btn-refresh');
    const elAiSummary = document.getElementById('ai-summary-text');
    const btnToggleAi = document.getElementById('toggle-ai-btn');

    // Toggle da IA
    if (btnToggleAi && elAiSummary) {
        btnToggleAi.addEventListener('click', () => {
            if (elAiSummary.style.display === 'none') {
                elAiSummary.style.display = 'block';
                btnToggleAi.innerHTML = '<i class="ph ph-caret-up"></i> Ocultar Panorama';
            } else {
                elAiSummary.style.display = 'none';
                btnToggleAi.innerHTML = '<i class="ph ph-caret-down"></i> Mostrar Panorama';
            }
        });
    }

    // Função de Animação de Contagem
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Gerador do Card de Notícia
    function createNewsCard(news, index) {
        // Formatar tag de data
        const dateStr = news.pubDate ? new Date(news.pubDate).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }) : 'Recente';

        // Ícone baseado no Sentimento
        let iconHtml = '<i class="ph ph-minus"></i>';
        if (news.sentiment === 'positiva') iconHtml = '<i class="ph ph-trend-up"></i>';
        if (news.sentiment === 'negativa') iconHtml = '<i class="ph ph-warning"></i>';

        return `
            <article class="news-item" style="animation-delay: ${index * 0.1}s">
                <div class="news-top">
                    <span class="news-source">
                        <i class="ph ph-globe-hemisphere-west"></i> ${news.source}
                    </span>
                    <span class="news-date">${dateStr}</span>
                </div>
                <a href="${news.link}" target="_blank" rel="noopener noreferrer" class="news-title">
                    ${news.title}
                </a>
                <div class="news-bottom">
                    <span class="sentiment-badge ${news.sentiment}">
                        ${iconHtml} ${news.sentiment}
                    </span>
                </div>
            </article>
        `;
    }

    // Lógica Principal de Fetching
    async function fetchDashboardData() {
        // Estado de Loading
        elNewsContainer.innerHTML = `
            <div class="loading-state">
                <i class="ph ph-spinner-gap spin"></i>
                <p>Verificando novas menções...</p>
            </div>
        `;

        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Falha ao conectar com o servidor do Monitor');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Atualizar os Stat Cards
            animateValue(elTotalMentions, 0, data.total_mentions || 0, 1500);
            animateValue(elSourcesCount, 0, data.sources_count || 0, 1500);
            
            elTrendLabel.innerHTML = data.trend_label;
            
            // Atualizar Resumo IA
            if (elAiSummary && data.ai_summary) {
                elAiSummary.innerText = data.ai_summary;
            }
            
            // Analisar sentimento dominante geral nas últimas
            const sentiments = data.latest_news.map(n => n.sentiment);
            const counts = sentiments.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
            
            let dominant = "Neutra";
            if ((counts['positiva'] || 0) > (counts['negativa'] || 0) && (counts['positiva'] || 0) > (counts['neutra'] || 0)) dominant = "Positiva";
            if ((counts['negativa'] || 0) > (counts['positiva'] || 0) && (counts['negativa'] || 0) > (counts['neutra'] || 0)) dominant = "Negativa (Atenção)";

            elSentiment.innerHTML = dominant;
            if(dominant === "Positiva") elSentiment.style.color = "var(--primary-green)";
            else if(dominant.includes("Negativa")) elSentiment.style.color = "#f44336";
            else elSentiment.style.color = "var(--text-main)";

            // Renderizar Lista de Notícias
            if(data.latest_news && data.latest_news.length > 0) {
                elNewsContainer.innerHTML = data.latest_news.map((news, index) => createNewsCard(news, index)).join('');
            } else {
                elNewsContainer.innerHTML = `
                    <div class="loading-state">
                        <i class="ph ph-folder-open"></i>
                        <p>Nenhuma menção capturada no momento.</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error(error);
            elNewsContainer.innerHTML = `
                <div class="loading-state">
                    <i class="ph ph-warning-circle" style="color: #f44336;"></i>
                    <p style="color: #f44336;">Erro ao buscar dados. O Tracker (server.py) está rodando localmente?</p>
                </div>
            `;
        }
    }

    // Bindings
    btnRefresh.addEventListener('click', () => {
        const icon = btnRefresh.querySelector('i');
        icon.classList.add('spin');
        fetchDashboardData().then(() => {
            setTimeout(() => icon.classList.remove('spin'), 500);
        });
    });

    // Interatividade da Sidebar mockada
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Impede do botão subir a tela pro topo #
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Iniciar
    fetchDashboardData();
    
    // Auto Update a cada 2 minutos
    setInterval(fetchDashboardData, 120000);
});
