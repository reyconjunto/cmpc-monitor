document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/news';

    // Elementos da DOM
    const elTotalMentions = document.getElementById('total-mentions');
    const elSourcesCount = document.getElementById('sources-count');
    const elSentiment = document.getElementById('sentiment-dominance');
    const elTrendLabel = document.getElementById('trend-label');
    const elNewsContainer = document.getElementById('news-container');
    const btnRefresh = document.getElementById('btn-refresh');
    const elAiSummary = document.getElementById('ai-summary-text');

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

            // Preencher o Termômetro da Comunidade
            if (data.community_thermometer) {
                const thermo = data.community_thermometer;
                const elTarget = document.getElementById('thermo-target');
                const elPost = document.getElementById('thermo-post');
                const elComments = document.getElementById('thermo-comments-count');
                
                if (elTarget) elTarget.innerText = thermo.target_profile;
                if (elPost) elPost.innerText = `"${thermo.post_title}"`;
                
                if (elComments) {
                    animateValue(elComments, 0, thermo.comments_analyzed, 1500);
                }
                
                // Animar Barras
                setTimeout(() => {
                    const posBar = document.getElementById('thermo-pos-bar');
                    const neuBar = document.getElementById('thermo-neu-bar');
                    const negBar = document.getElementById('thermo-neg-bar');
                    
                    if (posBar) {
                        posBar.style.width = thermo.sentiment_score.positivos + '%';
                        document.getElementById('thermo-pos-val').innerText = thermo.sentiment_score.positivos + '%';
                    }
                    if (neuBar) {
                        neuBar.style.width = thermo.sentiment_score.neutros + '%';
                        document.getElementById('thermo-neu-val').innerText = thermo.sentiment_score.neutros + '%';
                    }
                    if (negBar) {
                        negBar.style.width = thermo.sentiment_score.negativos + '%';
                        document.getElementById('thermo-neg-val').innerText = thermo.sentiment_score.negativos + '%';
                    }
                }, 100);

                // Preencher Tópicos
                const crisesList = document.getElementById('thermo-crises');
                const posList = document.getElementById('thermo-positives');
                
                if (crisesList && thermo.critical_topics) {
                    crisesList.innerHTML = thermo.critical_topics.map(t => `<li>${t}</li>`).join('');
                }
                if (posList && thermo.positive_topics) {
                    posList.innerHTML = thermo.positive_topics.map(t => `<li>${t}</li>`).join('');
                }
            }

            // Renderizar Lista de Notícias
            if(data.latest_news && data.latest_news.length > 0) {
                const sortedNews = data.latest_news.sort((a, b) => {
                    const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
                    const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
                    return dateB - dateA;
                });
                elNewsContainer.innerHTML = sortedNews.map((news, index) => createNewsCard(news, index)).join('');
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
    const sections = {
        0: 'section-overview',
        1: 'section-thermometer',
        2: 'section-ai',
        3: 'section-feed',
        4: 'section-analysis',
        5: 'section-alerts'
    };

    menuItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Impede do botão subir a tela pro topo #
            
            // Controle visual do Menu
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            // Controle visual das Abas
            Object.values(sections).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            
            const targetEl = document.getElementById(sections[index]);
            if (targetEl) targetEl.style.display = 'block';
        });
    });

    // Análise On-Demand do Termômetro (Nova Funcionalidade)
    const btnAnalyze = document.getElementById('btn-analyze-post');
    const inputUrl = document.getElementById('thermo-url-input');

    if(btnAnalyze && inputUrl) {
        btnAnalyze.addEventListener('click', async () => {
            const url = inputUrl.value.trim();
            if(!url) {
                alert("Por favor, cole o link do post do Instagram primeiro.");
                return;
            }

            // UI Loading state para o termômetro
            const elTarget = document.getElementById('thermo-target');
            const elPost = document.getElementById('thermo-post');
            const icon = btnAnalyze.querySelector('i');
            
            const isHashtag = !url.startsWith("http");
            
            btnAnalyze.disabled = true;
            btnAnalyze.style.opacity = '0.7';
            icon.classList.remove('ph-radar');
            icon.classList.add('ph-spinner-gap', 'spin');
            
            let loadingTitle = `<span style="color: var(--accent-orange)"><i class="ph ph-spinner-gap spin"></i> Rastreador Apify Acionado...</span>`;
            let loadingDesc = `"Puxando dados e aquecendo turbinas do Gemini IA... Aguarde (aprox. 30s)!"`;
            
            if (isHashtag) {
                 loadingTitle = `<span style="color: var(--primary-green)"><i class="ph ph-hash spin"></i> Varrimento Global em Massa Localizado...</span>`;
                 loadingDesc = `"Baixando de 3 a 5 posts de várias contas do mundo com a Tag principal e avaliando LOTE! (Pode levar até 45s)..."`;
            }

            if (elTarget) elTarget.innerHTML = loadingTitle;
            if (elPost) elPost.innerText = loadingDesc;
            
            document.getElementById('thermo-pos-bar').style.width = '0%';
            document.getElementById('thermo-neu-bar').style.width = '0%';
            document.getElementById('thermo-neg-bar').style.width = '0%';
            document.getElementById('thermo-comments-count').innerText = "0";

            try {
                const response = await fetch('/api/thermometer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url })
                });

                const thermo = await response.json();

                // Re-renderizar o bloco com os dados reais
                if (elTarget) elTarget.innerText = thermo.target_profile;
                if (elPost) elPost.innerText = `"${thermo.post_title}"`;
                
                const elComments = document.getElementById('thermo-comments-count');
                if (elComments && thermo.comments_analyzed !== undefined) {
                    animateValue(elComments, 0, thermo.comments_analyzed, 1500);
                }
                
                // Animar Barras
                setTimeout(() => {
                    const posBar = document.getElementById('thermo-pos-bar');
                    const neuBar = document.getElementById('thermo-neu-bar');
                    const negBar = document.getElementById('thermo-neg-bar');
                    
                    if (posBar && thermo.sentiment_score) {
                        posBar.style.width = thermo.sentiment_score.positivos + '%';
                        document.getElementById('thermo-pos-val').innerText = thermo.sentiment_score.positivos + '%';
                    }
                    if (neuBar && thermo.sentiment_score) {
                        neuBar.style.width = thermo.sentiment_score.neutros + '%';
                        document.getElementById('thermo-neu-val').innerText = thermo.sentiment_score.neutros + '%';
                    }
                    if (negBar && thermo.sentiment_score) {
                        negBar.style.width = thermo.sentiment_score.negativos + '%';
                        document.getElementById('thermo-neg-val').innerText = thermo.sentiment_score.negativos + '%';
                    }
                }, 100);

                // Preencher Tópicos
                const crisesList = document.getElementById('thermo-crises');
                const posList = document.getElementById('thermo-positives');
                
                if (crisesList && thermo.critical_topics) {
                    crisesList.innerHTML = thermo.critical_topics.map(t => `<li>${t}</li>`).join('');
                }
                if (posList && thermo.positive_topics) {
                    posList.innerHTML = thermo.positive_topics.map(t => `<li>${t}</li>`).join('');
                }

            } catch (err) {
                console.error(err);
                if (elTarget) elTarget.innerHTML = `<span style="color: #f44336">Erro na Análise</span>`;
                if (elPost) elPost.innerText = `"Não foi possível ler este URL. O servidor Python local está rodando?"`;
            } finally {
                btnAnalyze.disabled = false;
                btnAnalyze.style.opacity = '1';
                icon.classList.remove('ph-spinner-gap', 'spin');
                icon.classList.add('ph-radar');
            }
        });
    }

    // --- Lógica da Aba "Análise Preditiva" (Trends & Datalake) ---
    let trendsChartInstance = null;

    async function loadTrends() {
        try {
            const res = await fetch('/api/trends');
            const data = await res.json();
            
            const btnLastRun = document.getElementById('db-last-run');
            if(data.last_run) {
                btnLastRun.innerText = new Date(data.last_run).toLocaleString('pt-BR');
            } else {
                btnLastRun.innerText = "Sincronização inicial ainda não executada.";
            }

            if(data.historical_trends && data.historical_trends.length > 0) {
                renderChart(data.historical_trends);
            }
        } catch (e) {
            console.error("Erro ao ler Datalake:", e);
        }
    }

    function renderChart(historical_trends) {
        const ctx = document.getElementById('trendsChart').getContext('2d');
        const labels = historical_trends.map(t => {
            const dDate = new Date(t.date);
            return dDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + (isNaN(dDate)? t.date : ''); 
        });
        const posData = historical_trends.map(t => t.sentiment.positivos);
        const neuData = historical_trends.map(t => t.sentiment.neutros);
        const negData = historical_trends.map(t => t.sentiment.negativos);

        if(trendsChartInstance) {
            trendsChartInstance.destroy();
        }

        trendsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Positivo',
                        data: posData,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true,
                    },
                    {
                        label: 'Neutro',
                        data: neuData,
                        borderColor: '#9e9e9e',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.4,
                    },
                    {
                        label: 'Negativo/Crítico',
                        data: negData,
                        borderColor: '#f44336',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: 'white',
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, max: 100, ticks: { color: 'rgba(255,255,255,0.7)', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });
    }

    const btnForceSync = document.getElementById('btn-force-sync');
    if(btnForceSync) {
        btnForceSync.addEventListener('click', async () => {
            const loader = document.getElementById('chart-loader');
            const icon = btnForceSync.querySelector('i');
            
            btnForceSync.disabled = true;
            icon.classList.add('spin');
            loader.style.display = 'flex';

            try {
                const res = await fetch('/api/run-automation', { method: 'POST' });
                const json = await res.json();
                
                if(json.success && json.db.historical_trends) {
                    renderChart(json.db.historical_trends);
                    document.getElementById('db-last-run').innerText = new Date().toLocaleString('pt-BR');
                } else if (json.error) {
                    alert("Erro na Sincronização: " + json.error);
                }
            } catch (err) {
                alert("Falha de rede na sincronização.");
            } finally {
                btnForceSync.disabled = false;
                icon.classList.remove('spin');
                loader.style.display = 'none';
            }
        });
    }

    // Iniciar
    fetchDashboardData();
    loadTrends();
    
    // Auto Update a cada 30 minutos
    setInterval(() => {
        fetchDashboardData();
        loadTrends();
    }, 1800000);
});
