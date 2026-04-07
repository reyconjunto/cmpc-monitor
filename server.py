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
                
                # Mock Integration das Redes Sociais
                import email.utils
                from datetime import datetime, timezone
                current_time = email.utils.format_datetime(datetime.now(timezone.utc))
                items.insert(0, {
                    "title": "A @cmpc tá vindo com tudo!! A fábrica do Projeto Natureza na Barra do Ribeiro vai impulsionar a economia local e trazer novos empregos. Acompanhando de perto 🙌🏻🍃 #ProjetoNatureza #CMPC",
                    "link": "https://www.instagram.com/explore/tags/projetonatureza/",
                    "pubDate": current_time,
                    "source": "Instagram (@comunidade_rs)",
                    "sentiment": "positiva"
                })
                items.insert(1, {
                    "title": "Muita propaganda do novo polo de celulose da CMPC, mas precisamos cobrar transparência sobre o impacto na área! 🛑💧 #MeioAmbienteRS #BarraDoRibeiro",
                    "link": "https://twitter.com/search?q=CMPC%20Barra%20do%20Ribeiro",
                    "pubDate": current_time,
                    "source": "X (@ambientalistars)",
                    "sentiment": "negativa"
                })
                items.insert(2, {
                    "title": "Participei da audiência pública em Porto Alegre hoje. A expansão da fábrica vai trazer muito crescimento, mas a prefeitura de Barra do Ribeiro precisa preparar a infraestrutura local para aguentar o fluxo do Projeto Natureza da CMPC. Seguimos acompanhando os desdobramentos nas estradas também.",
                    "link": "https://facebook.com/search/posts?q=Projeto%20Natureza%20CMPC",
                    "pubDate": current_time,
                    "source": "Facebook (Grupo Barra do Ribeiro Debates)",
                    "sentiment": "neutra"
                })
                
                ai_summary = "A maioria das menções recentes destaca os investimentos bilionários e a geração de empregos com o 'Projeto Natureza' em Barra do Ribeiro. No entanto, o cruzamento de menções no X e Instagram revela cobranças pontuais sobre transparência ambiental, o que requer monitoramento ativo."
                api_key = os.environ.get("GEMINI_API_KEY")
                
                if HAS_GEMINI and api_key and len(items) > 0:
                    try:
                        genai.configure(api_key=api_key)
                        model = genai.GenerativeModel("gemini-1.5-flash")
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
                    "ai_summary": ai_summary
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
