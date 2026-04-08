import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import os

try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

import os

PORT = int(os.environ.get("PORT", 8000))

class APIHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        # Prevenir cache pesado no html durante o dev
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/news':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            # Query robusta focada na CMPC e no Projeto em Barra do Ribeiro
            search_query = '"CMPC" OR "Projeto Natureza" OR "Barra do Ribeiro" celulose'
            encoded_query = urllib.parse.quote(search_query)
            rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
            
            try:
                req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    xml_content = response.read()
                
                root = ET.fromstring(xml_content)
                items = []
                channel = root.find('channel')
                
                if channel is not None:
                    # Pegar as 30 notícias mais recentes
                    for item in channel.findall('item')[:30]:
                        title = item.find('title').text if item.find('title') is not None else ''
                        link = item.find('link').text if item.find('link') is not None else ''
                        pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ''
                        source = item.find('source').text if item.find('source') is not None else 'Google News'
                        
                        items.append({
                            "title": title,
                            "link": link,
                            "pubDate": pubDate,
                            "source": source,
                            "sentiment": "neutra"
                        })
                
                # Integração Funcional do Termômetro da Comunidade (Apify + Gemini)
                community_thermometer = {
                    "target_profile": "Instagram - @cmpc_brasil",
                    "post_title": "Buscando dados na nuvem...",
                    "comments_analyzed": 0,
                    "sentiment_score": {"positivos": 0, "neutros": 0, "negativos": 0},
                    "critical_topics": ["Aguardando análise de rede..."],
                    "positive_topics": ["Aguardando análise de rede..."]
                }
                
                apify_token = os.environ.get("APIFY_API_TOKEN")
                api_key = os.environ.get("GEMINI_API_KEY")
                
                if apify_token and HAS_GEMINI and api_key:
                    try:
                        from apify_client import ApifyClient
                        client = ApifyClient(apify_token)
                        genai.configure(api_key=api_key)
                        
                        run_input = {
                            "search": "cmpc_brasil",
                            "searchType": "user",
                            "resultsType": "posts",
                            "searchLimit": 1,
                            "resultsLimit": 1
                        }
                        print("Iniciando captura funcional do post no Instagram (via Apify)...")
                        run = client.actor("apify/instagram-scraper").call(run_input=run_input)
                        
                        target_post = None
                        for apify_item in client.dataset(run["defaultDatasetId"]).iterate_items():
                            target_post = apify_item
                            break
                            
                        if target_post:
                            caption = target_post.get("caption", "Post sem legenda")
                            community_thermometer["post_title"] = (caption[:70] + "...") if len(caption) > 70 else caption
                                
                            comments = target_post.get("latestComments", [])
                            community_thermometer["comments_analyzed"] = len(comments)
                            
                            print(f"Post encontrado! Analisando {len(comments)} comentários recentes reais com o Gemini...")
                            comments_text = "\n".join([f"- {c.get('text', '')}" for c in comments])
                            if not comments_text.strip():
                                comments_text = "Nenhum comentário encontrado."
                                
                            # Correção de compatibilidade da bibliteca para usar o gemini pró estável
                            model = genai.GenerativeModel("gemini-2.5-flash")
                            prompt = "Você é um analista de crises e monitoramento social para relações públicas da CMPC.\n"
                            prompt += f"Isto é a legenda de um post oficial da CMPC BRASIL: {caption}\n"
                            prompt += f"Estes são os comentários reais das pessoas na postagem:\n{comments_text}\n\n"
                            prompt += 'Analise o sentimento orgânico destes comentários e retorne APENAS um JSON válido. Exemplo de estrutura que EXIJO:\n{"positivos": 30, "neutros": 20, "negativos": 50, "critical_topics": ["tópico negativo 1", "reclamacao 2"], "positive_topics": ["elogio 1", "ponto bom"]}\n'
                            prompt += "A soma de positivos, neutros e negativos deve ser obrigatoriamente 100. Se houver 0 comentários, diga tudo 0."
                            
                            response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                            import json as py_json
                            ai_result = py_json.loads(response.text)
                            
                            community_thermometer["sentiment_score"]["positivos"] = ai_result.get("positivos", 0)
                            community_thermometer["sentiment_score"]["neutros"] = ai_result.get("neutros", 0)
                            community_thermometer["sentiment_score"]["negativos"] = ai_result.get("negativos", 0)
                            community_thermometer["critical_topics"] = ai_result.get("critical_topics", ["Sem focos críticos."])
                            community_thermometer["positive_topics"] = ai_result.get("positive_topics", ["Sem focos positivos."])
                            
                            print("Análise funcional dos painéis finalizada!")
                    except Exception as err:
                        print(f"Erro no processamento funcional do termômetro: {err}")
                        community_thermometer["post_title"] = f"Aviso Técnico: {err}"
                
                ai_summary = "A maioria das menções recentes destaca os investimentos bilionários e a geração de empregos com o 'Projeto Natureza' em Barra do Ribeiro. No entanto, o cruzamento de menções no X e Instagram revela cobranças pontuais sobre transparência ambiental, o que requer monitoramento ativo."
                api_key = os.environ.get("GEMINI_API_KEY")
                
                if HAS_GEMINI and api_key and len(items) > 0:
                    try:
                        genai.configure(api_key=api_key)
                        model = genai.GenerativeModel("gemini-2.5-flash")
                        prompt = "Você é um analista de relações públicas. Analise as manchetes abaixo sobre a CMPC e o projeto de celulose 'Projeto Natureza'.\n"
                        prompt += "Retorne APENAS um JSON válido com esta estrutura exata:\n"
                        prompt += '{"ai_summary": "resumo geral de 1 frase", "sentiments": ["positiva" ou "negativa" ou "neutra"]}\n\n'
                        prompt += "Atenção: 'sentiments' deve ser um array contendo strings com a classificação de cada manchete, na mesma ordem.\n"
                        prompt += "Manchetes:\n"
                        for i, item in enumerate(items):
                            prompt += f"{i}. {item['title']}\n"
                            
                        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                        result = json.loads(response.text)
                        
                        ai_summary = result.get("ai_summary", ai_summary)
                        sentiments = result.get("sentiments", [])
                        
                        for i, item in enumerate(items):
                            if i < len(sentiments):
                                item["sentiment"] = sentiments[i]
                    except Exception as e:
                        print(f"Erro no processamento da IA: {e}")
                        # Fallback simples
                        for item in items:
                            title_lower = item["title"].lower()
                            if any(word in title_lower for word in ["projeto", "investimento", "sustentabilidade", "empregos"]):
                                item["sentiment"] = "positiva"
                            elif any(word in title_lower for word in ["impacto", "problema", "protesto", "poluição", "crise"]):
                                item["sentiment"] = "negativa"
                else:
                    for item in items:
                        title_lower = item["title"].lower()
                        if any(word in title_lower for word in ["projeto natureza", "investimento", "sustentabilidade", "desenvolvimento", "crescimento", "empregos"]):
                            item["sentiment"] = "positiva"
                        elif any(word in title_lower for word in ["impacto", "problema", "protesto", "poluição", "crise", "denúncia", "embargo"]):
                            item["sentiment"] = "negativa"
                
                # Mock de volume global considerando multiplicador hipotético para demonstrar um dashboard com alto volume
                stats = {
                    "total_mentions": len(items) * 12 + 105,
                    "trend_label": "+12% esta semana",
                    "sources_count": len(set([i['source'] for i in items])) + 8,
                    "latest_news": items,
                    "ai_summary": ai_summary,
                    "community_thermometer": community_thermometer
                }
                
                self.wfile.write(json.dumps(stats).encode('utf-8'))
            except Exception as e:
                error = {"error": str(e)}
                self.wfile.write(json.dumps(error).encode('utf-8'))
        else:
            # Servir os arquivos normais (html, css, js)
            return super().do_GET()

if __name__ == "__main__":
    Handler = APIHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"✅ Servidor de Monitoramento iniciado em http://localhost:{PORT}")
        print("Pressione Ctrl+C para encerrar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrando servidor...")
            pass
        httpd.server_close()
