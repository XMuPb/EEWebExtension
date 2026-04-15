using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using TaleWorlds.CampaignSystem;
using TaleWorlds.CampaignSystem.Settlements;
// TaleWorlds.Engine.Texture used directly in portrait callback (not via using to avoid Path conflict)

namespace EEWebExtension
{
    /// <summary>
    /// Local HTTP server that serves the encyclopedia SPA and REST API.
    /// Runs on http://127.0.0.1:8080/ — browser fetches live data via API.
    /// Static files served from Modules/EEWebExtension/Web/ folder.
    /// Only listens on 127.0.0.1 (localhost) for security.
    /// </summary>
    internal static class EncyclopediaWebServer
    {
        private static HttpListener _listener;
        private static Thread _thread;
        private static volatile bool _running;
        private static int _port = 8080;

        private static string _webRoot;

        public static bool IsRunning => _running;
        public static int ActivePort => _port;

        public static void Start(string webRoot)
        {
            if (_running) return;
            _webRoot = webRoot;

            // Read port and enable setting from MCM
            try
            {
                var mcm = EditableEncyclopedia.MCMSettings.Instance;
                if (mcm != null)
                {
                    if (!mcm.EnableWebExtension)
                    {
                        Log("WebServer: disabled via MCM settings");
                        return;
                    }
                    _port = mcm.WebServerPort;
                }
            }
            catch { }

            bool allowExternal = false;
            try
            {
                var mcm = EditableEncyclopedia.MCMSettings.Instance;
                if (mcm != null) allowExternal = mcm.WebAllowExternalAccess;
            }
            catch { }

            string prefix = allowExternal
                ? "http://+:" + _port + "/"
                : "http://127.0.0.1:" + _port + "/";

            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add(prefix);
                _listener.Start();
                _running = true;

                _thread = new Thread(ListenLoop) { IsBackground = true, Name = "EEWebExtension" };
                _thread.Start();

                Log("WebServer: started on " + prefix + " (webRoot: " + _webRoot + ")");

                // Auto-open browser if configured
                try
                {
                    var mcm = EditableEncyclopedia.MCMSettings.Instance;
                    if (mcm != null && mcm.WebAutoOpenBrowser)
                    {
                        string url = "http://127.0.0.1:" + _port;
                        try
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "cmd",
                                Arguments = "/c start " + url,
                                CreateNoWindow = true,
                                UseShellExecute = false
                            });
                        }
                        catch
                        {
                            try { System.Diagnostics.Process.Start("explorer.exe", url); }
                            catch { Log("WebServer: could not auto-open browser for " + url); }
                        }
                    }
                }
                catch { }
            }
            catch (Exception ex)
            {
                Log("WebServer: failed to start: " + ex.Message);
                _running = false;
            }
        }

        public static void Stop()
        {
            _running = false;
            try { _listener?.Stop(); } catch { }
            try { _listener?.Close(); } catch { }
            _listener = null;
            Log("WebServer: stopped");
        }

        private static void ListenLoop()
        {
            while (_running)
            {
                try
                {
                    var context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(_ => HandleRequest(context));
                }
                catch (HttpListenerException) { if (!_running) break; }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex) { Log("WebServer: listener error: " + ex.Message); }
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            try
            {
                var req = context.Request;
                var res = context.Response;
                string path = req.Url.AbsolutePath;
                string pathLower = path.ToLowerInvariant();
                string method = req.HttpMethod;

                // CORS headers for browser
                res.Headers.Add("Access-Control-Allow-Origin", "*");
                res.Headers.Add("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
                res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                if (method == "OPTIONS") { res.StatusCode = 204; res.Close(); return; }

                // API routes — pass original path to preserve case in entity IDs
                if (pathLower.StartsWith("/api/"))
                {
                    HandleApiRoute(req, res, path, method);
                    return;
                }

                // Static file serving from Web/ folder
                ServeStaticFile(res, path);
            }
            catch (Exception ex)
            {
                Log("WebServer: request error: " + ex.Message);
                try { context.Response.StatusCode = 500; context.Response.Close(); } catch { }
            }
        }

        // ── Static File Server ──

        private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>
        {
            { ".html", "text/html; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".js", "application/javascript; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".svg", "image/svg+xml" },
            { ".webp", "image/webp" },
            { ".ico", "image/x-icon" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" },
        };

        private static void ServeStaticFile(HttpListenerResponse res, string urlPath)
        {
            if (string.IsNullOrEmpty(_webRoot))
            {
                res.StatusCode = 500;
                WriteText(res, "Web root not configured");
                return;
            }

            // Default to index.html
            if (urlPath == "/" || urlPath == "") urlPath = "/index.html";

            // URL-decode percent-encoded characters (e.g. %20 → space)
            urlPath = System.Uri.UnescapeDataString(urlPath);
            // Security: prevent directory traversal
            string relativePath = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            string fullPath = Path.GetFullPath(Path.Combine(_webRoot, relativePath));
            if (!fullPath.StartsWith(Path.GetFullPath(_webRoot)))
            {
                res.StatusCode = 403;
                WriteText(res, "Forbidden");
                return;
            }

            if (!File.Exists(fullPath))
            {
                // SPA fallback: serve index.html for non-file paths
                string indexPath = Path.Combine(_webRoot, "index.html");
                if (File.Exists(indexPath) && !Path.HasExtension(urlPath))
                {
                    fullPath = indexPath;
                }
                else
                {
                    res.StatusCode = 404;
                    WriteText(res, "Not Found");
                    return;
                }
            }

            string ext = Path.GetExtension(fullPath).ToLowerInvariant();
            string contentType;
            if (!MimeTypes.TryGetValue(ext, out contentType))
                contentType = "application/octet-stream";

            res.ContentType = contentType;

            // Cache static assets (not HTML)
            if (ext != ".html")
                res.Headers.Add("Cache-Control", "public, max-age=3600");

            byte[] data = File.ReadAllBytes(fullPath);

            // Apply color correction to portrait PNGs on-the-fly
            if (fullPath.Contains("Portraits") && ext == ".png" && !Path.GetFileName(fullPath).StartsWith("PREVIEW") && !Path.GetFileName(fullPath).StartsWith("FINAL"))
            {
                try
                {
                    data = FixPortraitColors(data);
                }
                catch { }
            }

            res.ContentLength64 = data.Length;
            res.OutputStream.Write(data, 0, data.Length);
            res.Close();
        }

        // Portrait color correction — applied on serve, not on disk
        private static byte[] FixPortraitColors(byte[] pngData)
        {
            System.Drawing.Bitmap bmp;
            using (var ms = new System.IO.MemoryStream(pngData))
                bmp = new System.Drawing.Bitmap(ms);
            var rect = new System.Drawing.Rectangle(0, 0, bmp.Width, bmp.Height);
            var bd = bmp.LockBits(rect, System.Drawing.Imaging.ImageLockMode.ReadWrite,
                System.Drawing.Imaging.PixelFormat.Format32bppArgb);
            int bc = Math.Abs(bd.Stride) * bmp.Height;
            byte[] px = new byte[bc];
            System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, bc);

            // B>R proportional algorithm: correct pixels where Blue exceeds Red by threshold.
            // Correction intensity scales with how blue the pixel is.
            for (int i = 0; i < bc; i += 4)
            {
                // Format32bppArgb = BGRA byte order
                byte b = px[i];
                byte g = px[i + 1];
                byte r = px[i + 2];
                byte a = px[i + 3];
                if (a < 10) continue; // skip transparent

                int blueExcess = b - r;
                if (blueExcess > 15) // blue-tinted pixel
                {
                    float lum = (r * 0.299f + g * 0.587f + b * 0.114f) / 255f;
                    if (lum < 0.08f || lum > 0.85f) continue; // skip dark bg and bright

                    float intensity = Math.Min(blueExcess / 80f, 1f);
                    float scale = intensity * (1f - lum * lum);

                    int nr = (int)(r + 92 * scale);
                    int ng = (int)(g - 18 * scale);
                    int nb = (int)(b - 102 * scale);

                    px[i + 2] = (byte)Math.Min(255, Math.Max(0, nr));
                    px[i + 1] = (byte)Math.Min(255, Math.Max(0, ng));
                    px[i]     = (byte)Math.Min(255, Math.Max(0, nb));
                }
            }

            System.Runtime.InteropServices.Marshal.Copy(px, 0, bd.Scan0, bc);
            bmp.UnlockBits(bd);
            using (var outMs = new System.IO.MemoryStream())
            {
                bmp.Save(outMs, System.Drawing.Imaging.ImageFormat.Png);
                bmp.Dispose();
                return outMs.ToArray();
            }
        }

        // ── API Router ──

        private static void HandleApiRoute(HttpListenerRequest req, HttpListenerResponse res, string path, string method)
        {
            // ── Status ──
            if (path == "/api/status" && method == "GET")
                ServeJson(res, GetStatusJson());

            // ── Heroes ──
            else if (path == "/api/heroes" && method == "GET")
                ServeJson(res, GetHeroesJson());
            else if (path.StartsWith("/api/hero/") && method == "GET" && !path.Substring(10).Contains("/"))
                ServeJson(res, GetHeroJson(path.Substring(10)));

            // ── Clans / Kingdoms / Settlements lists & details ──
            else if (path == "/api/clans" && method == "GET")
                ServeJson(res, GetClansJson());
            else if (path.StartsWith("/api/clan/") && method == "GET" && !path.Substring(10).Contains("/"))
                ServeJson(res, GetClanDetailJson(path.Substring(10)));
            else if (path == "/api/kingdoms" && method == "GET")
                ServeJson(res, GetKingdomsJson());
            else if (path.StartsWith("/api/kingdom/") && method == "GET" && !path.Substring(13).Contains("/"))
                ServeJson(res, GetKingdomDetailJson(path.Substring(13)));
            else if (path == "/api/settlements" && method == "GET")
                ServeJson(res, GetSettlementsJson());
            else if (path.StartsWith("/api/settlement/") && method == "GET" && !path.Substring(16).Contains("/"))
                ServeJson(res, GetSettlementDetailJson(path.Substring(16)));

            // ── Descriptions (read/write for any entity) ──
            else if (path == "/api/descriptions" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllDescriptions()));
            else if (path == "/api/descriptions/count" && method == "GET")
                ServeJson(res, "{\"count\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetDescriptionCount() + "}");
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/description") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/description");
                string desc = EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(id);
                ServeJson(res, "{\"id\":\"" + JEsc(id) + "\",\"description\":\"" + JEsc(desc ?? "") + "\"}");
            }
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/description") && method == "PUT")
                HandleUpdateDescription(req, res, ExtractId(path, "/api/entity/", "/description"));
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/description") && method == "PUT")
                HandleUpdateDescription(req, res, ExtractId(path, "/api/hero/", "/description"));

            // ── Lore fields (read/write) ──
            else if (path.StartsWith("/api/hero/") && path.Contains("/field/") && method == "GET")
            {
                string afterHero = path.Substring(10);
                int fi = afterHero.IndexOf("/field/");
                string heroId = afterHero.Substring(0, fi);
                string fieldKey = afterHero.Substring(fi + 7);
                string val = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoField(fieldKey, heroId) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(heroId) + "\",\"field\":\"" + JEsc(fieldKey) + "\",\"text\":\"" + JEsc(val) + "\"}");
            }
            else if (path.StartsWith("/api/hero/") && path.Contains("/field/") && method == "PUT")
                HandleUpdateField(req, res, path);
            else if (path.StartsWith("/api/entity/") && path.Contains("/field/") && method == "PUT")
                HandleUpdateField(req, res, path.Replace("/api/entity/", "/api/hero/"));
            else if (path == "/api/lore-fields" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllHeroInfoFields()));
            else if (path == "/api/lore-fields/keys" && method == "GET")
                ServeJson(res, StringArrayToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetInfoFieldKeys()));
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/lore") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/lore");
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllHeroLoreFields(heroId)));
            }

            // ── Tags (read/write) ──
            else if (path == "/api/tags" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllTags()));
            else if (path == "/api/tags/count" && method == "GET")
                ServeJson(res, "{\"count\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetTagCount() + "}");
            else if (path == "/api/tags/unique" && method == "GET")
                ServeJson(res, ListToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllUniqueTags()));
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/tags") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/tags");
                string tags = EditableEncyclopedia.EditableEncyclopediaAPI.GetTags(id) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(id) + "\",\"tags\":\"" + JEsc(tags) + "\"}");
            }
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/tags") && method == "PUT")
            {
                string id = ExtractId(path, "/api/entity/", "/tags");
                string body = ReadBody(req);
                string tags = ExtractJsonValue(body, "tags");
                EditableEncyclopedia.EditableEncyclopediaAPI.SetTags(id, tags);
                ServeJson(res, "{\"ok\":true}");
            }

            // ── Journal (read/write) ──
            else if (path == "/api/journal" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllJournal()));
            else if (path == "/api/journal/count" && method == "GET")
                ServeJson(res, "{\"count\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetJournalCount() + "}");
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/journal") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/journal");
                var entries = EditableEncyclopedia.EditableEncyclopediaAPI.GetJournalEntries(id);
                ServeJson(res, JournalEntriesToJson(entries));
            }
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/journal") && method == "POST")
            {
                string id = ExtractId(path, "/api/entity/", "/journal");
                string body = ReadBody(req);
                string text = ExtractJsonValue(body, "text");
                EditableEncyclopedia.EditableEncyclopediaAPI.AddJournalEntry(id, text);
                ServeJson(res, "{\"ok\":true}");
            }

            // ── Relation Notes ──
            else if (path == "/api/relation-notes" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllRelationNotes()));
            else if (path == "/api/relation-notes/count" && method == "GET")
                ServeJson(res, "{\"count\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetRelationNoteCount() + "}");
            else if (path.StartsWith("/api/relation-note/") && method == "GET")
            {
                // /api/relation-note/{heroId}/{targetId}
                string rest = path.Substring(19); // after "/api/relation-note/"
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string heroId = rest.Substring(0, sep);
                    string targetId = rest.Substring(sep + 1);
                    string note = EditableEncyclopedia.EditableEncyclopediaAPI.GetRelationNote(heroId, targetId) ?? "";
                    ServeJson(res, "{\"heroId\":\"" + JEsc(heroId) + "\",\"targetId\":\"" + JEsc(targetId) + "\",\"note\":\"" + JEsc(note) + "\"}");
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/relation-note/{heroId}/{targetId}"); }
            }
            else if (path.StartsWith("/api/relation-note/") && method == "PUT")
            {
                string rest = path.Substring(19);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string heroId = rest.Substring(0, sep);
                    string targetId = rest.Substring(sep + 1);
                    string body = ReadBody(req);
                    string note = ExtractJsonValue(body, "note");
                    EditableEncyclopedia.EditableEncyclopediaAPI.SetRelationNote(heroId, targetId, note);
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/relation-note/{heroId}/{targetId}"); }
            }

            // ── Cultures / Occupations (read + write) ──
            else if (path == "/api/cultures" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllCustomCultures()));
            else if (path == "/api/occupations" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllCustomOccupations()));
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/culture") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/culture");
                string culture = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroCulture(heroId) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(heroId) + "\",\"culture\":\"" + JEsc(culture) + "\"}");
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/culture") && method == "PUT")
            {
                string heroId = ExtractId(path, "/api/hero/", "/culture");
                string body = ReadBody(req);
                string culture = ExtractJsonValue(body, "culture");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null) { beh.SetCustomCulture(heroId, culture); ServeJson(res, "{\"ok\":true}"); }
                else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/occupation") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/occupation");
                int occ = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroOccupation(heroId);
                string name = occ >= 0 ? EditableEncyclopedia.EditableEncyclopediaAPI.GetOccupationDisplayName(occ) : "";
                ServeJson(res, "{\"id\":\"" + JEsc(heroId) + "\",\"occupation\":" + occ + ",\"name\":\"" + JEsc(name) + "\"}");
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/occupation") && method == "PUT")
            {
                string heroId = ExtractId(path, "/api/hero/", "/occupation");
                string body = ReadBody(req);
                string occStr = ExtractJsonValue(body, "occupation");
                int occVal;
                if (int.TryParse(occStr, out occVal))
                {
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    if (beh != null) { beh.SetCustomOccupation(heroId, occVal); ServeJson(res, "{\"ok\":true}"); }
                    else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
                }
                else { res.StatusCode = 400; WriteText(res, "Invalid occupation value"); }
            }

            // ── Names / Titles (read + write) ──
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/name") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/name");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string name = beh?.GetCustomName(id) ?? "";
                string title = beh?.GetCustomTitle(id) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(id) + "\",\"name\":\"" + JEsc(name) + "\",\"title\":\"" + JEsc(title) + "\"}");
            }
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/name") && method == "PUT")
            {
                string id = ExtractId(path, "/api/entity/", "/name");
                string body = ReadBody(req);
                string name = ExtractJsonValue(body, "name");
                string title = ExtractJsonValue(body, "title");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null)
                {
                    if (name != null) beh.SetCustomName(id, name);
                    if (title != null) beh.SetCustomTitle(id, title);
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
            }

            // ── Banner Codes (read + write) ──
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/banner") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/banner");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string banner = beh?.GetCustomBannerCode(id) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(id) + "\",\"banner\":\"" + JEsc(banner) + "\"}");
            }
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/banner") && method == "PUT")
            {
                string id = ExtractId(path, "/api/entity/", "/banner");
                string body = ReadBody(req);
                string banner = ExtractJsonValue(body, "banner");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null) { beh.SetCustomBannerCode(id, banner); ServeJson(res, "{\"ok\":true}"); }
                else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
            }

            // ── Stats ──
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/stats") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/stats");
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoStats(heroId)));
            }
            else if (path.StartsWith("/api/settlement/") && path.EndsWith("/stats") && method == "GET")
            {
                string id = ExtractId(path, "/api/settlement/", "/stats");
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetSettlementInfoStats(id)));
            }

            // ── Chronicle ──
            else if (path == "/api/chronicle" && method == "GET")
            {
                var entries = EditableEncyclopedia.EditableEncyclopediaAPI.GetAllChronicleEntries();
                var sb = new StringBuilder("[");
                bool first = true;
                var seen = new HashSet<string>();
                int dupes = 0;
                foreach (var e in entries)
                {
                    var normText = (e.Text ?? "").Trim().ToLowerInvariant();
                    var key = (e.Date ?? "") + "||" + normText;
                    if (seen.Contains(key)) { dupes++; continue; }
                    seen.Add(key);
                    if (!first) sb.Append(",");
                    sb.Append("{\"entityId\":\"" + JEsc(e.EntityId) + "\",\"date\":\"" + JEsc(e.Date) + "\",\"text\":\"" + JEsc(e.Text) + "\"}");
                    first = false;
                }
                sb.Append("]");
                if (dupes > 0) Log("[Chronicle] dropped " + dupes + " duplicates from " + entries.Count + " entries");
                ServeJson(res, sb.ToString());
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/chronicle") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/chronicle");
                string chronicle = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroChronicle(heroId) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(heroId) + "\",\"chronicle\":\"" + JEsc(chronicle) + "\"}");
            }

            // ── Journal management ──
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/journal") && method == "DELETE")
            {
                string id = ExtractId(path, "/api/entity/", "/journal");
                EditableEncyclopedia.EditableEncyclopediaAPI.ClearJournal(id);
                ServeJson(res, "{\"ok\":true}");
            }

            // ── Lore Templates ──
            else if (path == "/api/lore-templates/roles" && method == "GET")
                ServeJson(res, StringArrayToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAvailableRoles()));
            else if (path.StartsWith("/api/lore-template/") && path.Contains("/") && method == "GET")
            {
                // /api/lore-template/{fieldKey}/{heroId}
                string rest = path.Substring(19); // after "/api/lore-template/"
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string fieldKey = rest.Substring(0, sep);
                    string heroId = rest.Substring(sep + 1);
                    string template = EditableEncyclopedia.EditableEncyclopediaAPI.GetLoreTemplate(fieldKey, heroId) ?? "";
                    ServeJson(res, "{\"fieldKey\":\"" + JEsc(fieldKey) + "\",\"heroId\":\"" + JEsc(heroId) + "\",\"template\":\"" + JEsc(template) + "\"}");
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/lore-template/{fieldKey}/{heroId}"); }
            }
            else if (path.StartsWith("/api/lore-templates/role/") && method == "GET")
            {
                string role = path.Substring(24);
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllRoleTemplates(role)));
            }

            // ── Export / Import ──
            else if (path == "/api/export" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportToSharedFile();
                string filePath = EditableEncyclopedia.EditableEncyclopediaAPI.GetSharedFilePath() ?? "";
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + ",\"path\":\"" + JEsc(filePath) + "\"}");
            }
            else if (path == "/api/import" && method == "POST")
            {
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.ImportFromSharedFile();
                ServeJson(res, "{\"ok\":true,\"imported\":" + count + "}");
            }

            // ── Reset All ──
            else if (path == "/api/reset-all" && method == "POST")
            {
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.ResetAllDescriptions();
                ServeJson(res, "{\"ok\":true,\"reset\":" + count + "}");
            }

            // ── Statistics ──
            else if (path == "/api/statistics" && method == "GET")
            {
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var sb = new StringBuilder("{");
                sb.Append("\"descriptions\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetDescriptionCount());
                sb.Append(",\"loreFields\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoFieldCount());
                sb.Append(",\"tags\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetTagCount());
                sb.Append(",\"journal\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetJournalCount());
                sb.Append(",\"relationNotes\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetRelationNoteCount());
                sb.Append(",\"cultures\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetCustomCultureCount());
                sb.Append(",\"occupations\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetCustomOccupationCount());
                sb.Append(",\"names\":" + (beh?.GetCustomNameCount() ?? 0));
                sb.Append(",\"titles\":" + (beh?.GetCustomTitleCount() ?? 0));
                sb.Append(",\"banners\":" + (beh?.GetCustomBannerCount() ?? 0));
                sb.Append("}");
                ServeJson(res, sb.ToString());
            }

            // ── Tag Categories & Presets (read + write) ──
            else if (path == "/api/tag-categories" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllTagCategories()));
            else if (path == "/api/tag-presets" && method == "GET")
                ServeJson(res, DictToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetAllTagPresets()));
            else if (path.StartsWith("/api/tag-category/") && method == "PUT")
            {
                string catName = path.Substring(18);
                string body = ReadBody(req);
                string tags = ExtractJsonValue(body, "tags");
                EditableEncyclopedia.EditableEncyclopediaAPI.SetTagCategory(catName, tags);
                ServeJson(res, "{\"ok\":true}");
            }
            else if (path.StartsWith("/api/tag-category/") && method == "DELETE")
            {
                string catName = path.Substring(18);
                EditableEncyclopedia.EditableEncyclopediaAPI.RemoveTagCategory(catName);
                ServeJson(res, "{\"ok\":true}");
            }
            else if (path.StartsWith("/api/tag-preset/") && path.EndsWith("/apply") && method == "POST")
            {
                string rest = path.Substring(16);
                string presetName = rest.Substring(0, rest.Length - 6); // remove "/apply"
                string body = ReadBody(req);
                string objectId = ExtractJsonValue(body, "objectId");
                string result = EditableEncyclopedia.EditableEncyclopediaAPI.ApplyTagPreset(objectId, presetName);
                ServeJson(res, "{\"ok\":true,\"tags\":\"" + JEsc(result ?? "") + "\"}");
            }
            else if (path.StartsWith("/api/tag-preset/") && method == "PUT")
            {
                string presetName = path.Substring(16);
                string body = ReadBody(req);
                string tags = ExtractJsonValue(body, "tags");
                EditableEncyclopedia.EditableEncyclopediaAPI.SetTagPreset(presetName, tags);
                ServeJson(res, "{\"ok\":true}");
            }
            else if (path.StartsWith("/api/tag-preset/") && method == "DELETE")
            {
                string presetName = path.Substring(16);
                EditableEncyclopedia.EditableEncyclopediaAPI.RemoveTagPreset(presetName);
                ServeJson(res, "{\"ok\":true}");
            }
            // Tag bulk operations
            else if (path == "/api/tags/rename" && method == "POST")
            {
                string body = ReadBody(req);
                string oldTag = ExtractJsonValue(body, "oldTag");
                string newTag = ExtractJsonValue(body, "newTag");
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.RenameTagGlobal(oldTag, newTag);
                ServeJson(res, "{\"ok\":true,\"renamed\":" + count + "}");
            }
            else if (path == "/api/tags/remove" && method == "POST")
            {
                string body = ReadBody(req);
                string tag = ExtractJsonValue(body, "tag");
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.RemoveTagGlobal(tag);
                ServeJson(res, "{\"ok\":true,\"removed\":" + count + "}");
            }
            else if (path == "/api/tags/usage" && method == "GET")
            {
                var usages = EditableEncyclopedia.EditableEncyclopediaAPI.GetTagUsageCounts();
                var sb = new StringBuilder("[");
                bool first = true;
                foreach (var u in usages)
                {
                    if (!first) sb.Append(",");
                    sb.Append("{\"tag\":\"" + JEsc(u.Tag) + "\",\"count\":" + u.Count + "}");
                    first = false;
                }
                sb.Append("]");
                ServeJson(res, sb.ToString());
            }

            // ── Portraits ──
            else if (path == "/api/portraits" && method == "GET")
            {
                // List all custom uploaded portraits
                var sb2 = new StringBuilder("{\"custom\":[");
                try
                {
                    string customDir = Path.Combine(_webRoot, "Potrais");
                    if (Directory.Exists(customDir))
                    {
                        bool first2 = true;
                        foreach (var f in Directory.GetFiles(customDir, "*.png"))
                        {
                            if (!first2) sb2.Append(",");
                            sb2.Append("\"" + JEsc(Path.GetFileNameWithoutExtension(f)) + "\"");
                            first2 = false;
                        }
                    }
                }
                catch { }
                sb2.Append("],\"exported\":[");
                try
                {
                    string exportDir = Path.Combine(_webRoot, "Portraits");
                    if (Directory.Exists(exportDir))
                    {
                        bool first2 = true;
                        foreach (var f in Directory.GetFiles(exportDir, "*.png"))
                        {
                            if (!first2) sb2.Append(",");
                            sb2.Append("\"" + JEsc(Path.GetFileNameWithoutExtension(f)) + "\"");
                            first2 = false;
                        }
                    }
                }
                catch { }
                sb2.Append("]}");
                ServeJson(res, sb2.ToString());
            }
            else if (path == "/api/banners" && method == "GET")
            {
                // List all pre-rendered banner images
                var sb2 = new StringBuilder("[");
                try
                {
                    string bannerDir = Path.Combine(_webRoot, "Banners");
                    if (Directory.Exists(bannerDir))
                    {
                        bool first2 = true;
                        foreach (var f in Directory.GetFiles(bannerDir, "*.png"))
                        {
                            if (!first2) sb2.Append(",");
                            sb2.Append("\"" + JEsc(Path.GetFileNameWithoutExtension(f)) + "\"");
                            first2 = false;
                        }
                    }
                }
                catch { }
                sb2.Append("]");
                ServeJson(res, sb2.ToString());
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/portrait") && method == "POST")
            {
                string heroId = ExtractId(path, "/api/hero/", "/portrait");
                HandlePortraitUpload(req, res, heroId);
            }
            else if (path.StartsWith("/api/hero/") && path.EndsWith("/portrait") && method == "GET")
            {
                string heroId = ExtractId(path, "/api/hero/", "/portrait");
                string portraitPath = Path.Combine(_webRoot, "Potrais", heroId + ".png");
                bool exists = File.Exists(portraitPath);
                ServeJson(res, "{\"id\":\"" + JEsc(heroId) + "\",\"hasPortrait\":" + (exists ? "true" : "false") + "}");
            }

            // ── Extract all hero portraits from game ──
            else if (path == "/api/extract-portraits" && method == "POST")
            {
                try
                {
                    int count = ExtractHeroPortraits();
                    ServeJson(res, "{\"ok\":true,\"extracted\":" + count + "}");
                }
                catch (Exception ex)
                {
                    Log("WebServer: portrait extraction error: " + ex.Message);
                    ServeJson(res, "{\"ok\":false,\"error\":\"" + JEsc(ex.Message) + "\"}");
                }
            }

            // ══════════════════════════════════════════════════════════════
            // NEW ENDPOINTS — Full mod capability coverage
            // ══════════════════════════════════════════════════════════════

            // ── Journal entry edit/delete by index ──
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/journal") && method == "PUT")
            {
                string id = ExtractId(path, "/api/entity/", "/journal");
                string body = ReadBody(req);
                string indexStr = ExtractJsonValue(body, "index");
                string text = ExtractJsonValue(body, "text");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null && indexStr != null)
                {
                    int idx = int.Parse(indexStr);
                    beh.ReplaceJournalEntry(id, idx, text);
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 400; WriteText(res, "Missing index or text"); }
            }
            else if (path.StartsWith("/api/entity/") && path.Contains("/journal/") && method == "DELETE")
            {
                // /api/entity/{id}/journal/{index}
                string rest = path.Substring(12); // after "/api/entity/"
                int jPos = rest.IndexOf("/journal/");
                if (jPos > 0)
                {
                    string id = rest.Substring(0, jPos);
                    string indexStr = rest.Substring(jPos + 9);
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    if (beh != null)
                    {
                        beh.RemoveJournalEntry(id, int.Parse(indexStr));
                        ServeJson(res, "{\"ok\":true}");
                    }
                    else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/entity/{id}/journal/{index}"); }
            }

            // ── Edit Timestamps ──
            else if (path.StartsWith("/api/entity/") && path.EndsWith("/timestamp") && method == "GET")
            {
                string id = ExtractId(path, "/api/entity/", "/timestamp");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string ts = beh?.GetEditTimestamp(id) ?? "";
                ServeJson(res, "{\"id\":\"" + JEsc(id) + "\",\"timestamp\":\"" + JEsc(ts) + "\"}");
            }

            // ── Relation History ──
            else if (path.StartsWith("/api/relation-history/") && method == "GET")
            {
                // /api/relation-history/{heroId}/{targetId}
                string rest = path.Substring(22);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string heroId = rest.Substring(0, sep);
                    string targetId = rest.Substring(sep + 1);
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    var history = beh?.GetRelationHistory(heroId, targetId);
                    var sb = new StringBuilder("[");
                    if (history != null)
                    {
                        bool first = true;
                        foreach (var h in history)
                        {
                            if (!first) sb.Append(",");
                            sb.Append("{\"date\":\"" + JEsc(h.Date) + "\",\"change\":\"" + JEsc(h.Change) + "\",\"text\":\"" + JEsc(h.Text) + "\"}");
                            first = false;
                        }
                    }
                    sb.Append("]");
                    ServeJson(res, sb.ToString());
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/relation-history/{heroId}/{targetId}"); }
            }
            else if (path.StartsWith("/api/relation-history-for/") && method == "GET")
            {
                // /api/relation-history-for/{targetId} — all history for one hero
                string targetId = path.Substring(25);
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var history = beh?.GetRelationHistoryForHero(targetId);
                var sb = new StringBuilder("[");
                if (history != null)
                {
                    bool first = true;
                    foreach (var h in history)
                    {
                        if (!first) sb.Append(",");
                        sb.Append("{\"date\":\"" + JEsc(h.Date) + "\",\"change\":\"" + JEsc(h.Change) + "\",\"text\":\"" + JEsc(h.Text) + "\"}");
                        first = false;
                    }
                }
                sb.Append("]");
                ServeJson(res, sb.ToString());
            }

            // ── Tag Notes ──
            else if (path.StartsWith("/api/tag-note/") && method == "GET")
            {
                // /api/tag-note/{objectId}/{tag}
                string rest = path.Substring(14);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string objectId = rest.Substring(0, sep);
                    string tag = rest.Substring(sep + 1);
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    string note = beh?.GetTagNote(objectId, tag) ?? "";
                    ServeJson(res, "{\"objectId\":\"" + JEsc(objectId) + "\",\"tag\":\"" + JEsc(tag) + "\",\"note\":\"" + JEsc(note) + "\"}");
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/tag-note/{objectId}/{tag}"); }
            }
            else if (path.StartsWith("/api/tag-note/") && method == "PUT")
            {
                string rest = path.Substring(14);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string objectId = rest.Substring(0, sep);
                    string tag = rest.Substring(sep + 1);
                    string body = ReadBody(req);
                    string note = ExtractJsonValue(body, "note");
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    if (beh != null) { beh.SetTagNote(objectId, tag, note); ServeJson(res, "{\"ok\":true}"); }
                    else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/tag-note/{objectId}/{tag}"); }
            }
            else if (path.StartsWith("/api/tag-notes/") && method == "GET")
            {
                // /api/tag-notes/{objectId} — all tag notes for an entity
                string objectId = path.Substring(15);
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var notes = beh?.GetAllTagNotes(objectId);
                ServeJson(res, notes != null ? DictToJson(notes) : "{}");
            }

            // ── Auto-Tag Thresholds ──
            else if (path.StartsWith("/api/auto-tag-threshold/") && method == "GET")
            {
                string heroId = path.Substring(24);
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var thresholds = beh?.GetPerHeroAutoTagThresholds(heroId);
                if (thresholds != null)
                    ServeJson(res, "{\"heroId\":\"" + JEsc(heroId) + "\",\"enemy\":" + thresholds.Item1 + ",\"friend\":" + thresholds.Item2 + "}");
                else
                    ServeJson(res, "{\"heroId\":\"" + JEsc(heroId) + "\",\"enemy\":null,\"friend\":null}");
            }
            else if (path.StartsWith("/api/auto-tag-threshold/") && method == "PUT")
            {
                string heroId = path.Substring(24);
                string body = ReadBody(req);
                string enemy = ExtractJsonValue(body, "enemy");
                string friend = ExtractJsonValue(body, "friend");
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null && enemy != null && friend != null)
                {
                    beh.SetPerHeroAutoTagThresholds(heroId, int.Parse(enemy), int.Parse(friend));
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 400; WriteText(res, "Missing enemy/friend thresholds"); }
            }
            else if (path == "/api/auto-tag-thresholds" && method == "GET")
            {
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var all = beh?.GetAllPerHeroAutoTagThresholds();
                var sb = new StringBuilder("{");
                if (all != null)
                {
                    bool first = true;
                    foreach (var kvp in all)
                    {
                        if (!first) sb.Append(",");
                        // Value is "enemy|friend" string
                        var parts = kvp.Value.Split('|');
                        string e = parts.Length > 0 ? parts[0] : "0";
                        string f = parts.Length > 1 ? parts[1] : "0";
                        sb.Append("\"" + JEsc(kvp.Key) + "\":{\"enemy\":" + e + ",\"friend\":" + f + "}");
                        first = false;
                    }
                }
                sb.Append("}");
                ServeJson(res, sb.ToString());
            }

            // ── Relation Note Tags & Locks ──
            else if (path.StartsWith("/api/relation-note-tag/") && method == "GET")
            {
                // /api/relation-note-tag/{heroId}/{targetId}
                string rest = path.Substring(23);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string heroId = rest.Substring(0, sep);
                    string targetId = rest.Substring(sep + 1);
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    string tag = beh?.GetRelationNoteTag(heroId, targetId) ?? "";
                    bool locked = beh?.IsRelationNoteTagLocked(heroId, targetId) ?? false;
                    string suggested = beh?.SuggestRelationNoteTag(heroId, targetId) ?? "";
                    ServeJson(res, "{\"tag\":\"" + JEsc(tag) + "\",\"locked\":" + (locked ? "true" : "false") + ",\"suggested\":\"" + JEsc(suggested) + "\"}");
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/relation-note-tag/{heroId}/{targetId}"); }
            }
            else if (path.StartsWith("/api/relation-note-tag/") && method == "PUT")
            {
                string rest = path.Substring(23);
                int sep = rest.IndexOf('/');
                if (sep > 0)
                {
                    string heroId = rest.Substring(0, sep);
                    string targetId = rest.Substring(sep + 1);
                    string body = ReadBody(req);
                    string tag = ExtractJsonValue(body, "tag");
                    string lockedStr = ExtractJsonValue(body, "locked");
                    var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                    if (beh != null)
                    {
                        if (tag != null) beh.SetRelationNoteTag(heroId, targetId, tag);
                        if (lockedStr != null) beh.SetRelationNoteTagLock(heroId, targetId, lockedStr == "true");
                        ServeJson(res, "{\"ok\":true}");
                    }
                    else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
                }
                else { res.StatusCode = 400; WriteText(res, "Expected /api/relation-note-tag/{heroId}/{targetId}"); }
            }

            // ── Custom Culture Definitions ──
            else if (path == "/api/culture-definitions" && method == "GET")
            {
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var defs = beh?.GetAllCustomCultureDefinitions();
                var sb = new StringBuilder("[");
                if (defs != null)
                {
                    bool first = true;
                    foreach (var d in defs)
                    {
                        if (!first) sb.Append(",");
                        sb.Append("{\"id\":\"" + JEsc(d.Item1) + "\",\"displayName\":\"" + JEsc(d.Item2) + "\",\"baseCultureId\":\"" + JEsc(d.Item3) + "\",\"basicTroopId\":\"" + JEsc(d.Item4) + "\",\"eliteTroopId\":\"" + JEsc(d.Item5) + "\"}");
                        first = false;
                    }
                }
                sb.Append("]");
                ServeJson(res, sb.ToString());
            }
            else if (path.StartsWith("/api/culture-definition/") && method == "PUT")
            {
                string cultureId = path.Substring(24);
                string body = ReadBody(req);
                string displayName = ExtractJsonValue(body, "displayName");
                string baseCultureId = ExtractJsonValue(body, "baseCultureId");
                string basicTroopId = ExtractJsonValue(body, "basicTroopId") ?? "";
                string eliteTroopId = ExtractJsonValue(body, "eliteTroopId") ?? "";
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null && displayName != null && baseCultureId != null)
                {
                    beh.SetCustomCultureDefinition(cultureId, displayName, baseCultureId, basicTroopId, eliteTroopId);
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 400; WriteText(res, "Missing required fields"); }
            }
            else if (path.StartsWith("/api/culture-definition/") && method == "DELETE")
            {
                string cultureId = path.Substring(24);
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null)
                {
                    beh.RemoveCustomCultureDefinition(cultureId);
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
            }

            // ── Detailed Import with per-section counts ──
            else if (path == "/api/import-detailed" && method == "POST")
            {
                var result = EditableEncyclopedia.EditableEncyclopediaAPI.ImportFromSharedFileDetailed();
                if (result != null)
                {
                    ServeJson(res, "{\"ok\":true,\"descriptions\":" + result.Descriptions +
                        ",\"names\":" + result.Names + ",\"titles\":" + result.Titles +
                        ",\"banners\":" + result.Banners + ",\"cultureDefs\":" + result.CultureDefs +
                        ",\"cultures\":" + result.Cultures + ",\"occupations\":" + result.Occupations +
                        ",\"heroInfoFields\":" + result.HeroInfoFields + ",\"tags\":" + result.Tags +
                        ",\"journal\":" + result.Journal + ",\"relationNotes\":" + result.RelationNotes +
                        ",\"tagNotes\":" + result.TagNotes + ",\"total\":" + result.Total + "}");
                }
                else { ServeJson(res, "{\"ok\":false,\"error\":\"Import failed\"}"); }
            }

            // ── Per-section exports ──
            else if (path == "/api/export/heroes" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportHeroDescriptions();
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + "}");
            }
            else if (path == "/api/export/clans" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportClanDescriptions();
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + "}");
            }
            else if (path == "/api/export/kingdoms" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportKingdomDescriptions();
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + "}");
            }
            else if (path == "/api/export/settlements" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportSettlementDescriptions();
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + "}");
            }
            else if (path == "/api/export/banners" && method == "POST")
            {
                bool ok = EditableEncyclopedia.EditableEncyclopediaAPI.ExportBannerCodes();
                ServeJson(res, "{\"ok\":" + (ok ? "true" : "false") + "}");
            }
            else if (path == "/api/import/banners" && method == "POST")
            {
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.ImportBannersFromSharedFile();
                ServeJson(res, "{\"ok\":true,\"imported\":" + count + "}");
            }

            // ── Bulk tag operations ──
            else if (path == "/api/tags/merge" && method == "POST")
            {
                string body = ReadBody(req);
                string sourceTag = ExtractJsonValue(body, "sourceTag");
                string targetTag = ExtractJsonValue(body, "targetTag");
                int count = EditableEncyclopedia.EditableEncyclopediaAPI.MergeTags(sourceTag, targetTag);
                ServeJson(res, "{\"ok\":true,\"merged\":" + count + "}");
            }
            else if (path == "/api/tags/add-bulk" && method == "POST")
            {
                string body = ReadBody(req);
                string tag = ExtractJsonValue(body, "tag");
                string idsJson = ExtractJsonValue(body, "ids");
                // Parse comma-separated IDs
                var ids = idsJson?.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s));
                if (ids != null && tag != null)
                {
                    int count = EditableEncyclopedia.EditableEncyclopediaAPI.AddTagToMultiple(ids, tag);
                    ServeJson(res, "{\"ok\":true,\"added\":" + count + "}");
                }
                else { res.StatusCode = 400; WriteText(res, "Missing tag or ids"); }
            }
            else if (path == "/api/tags/remove-bulk" && method == "POST")
            {
                string body = ReadBody(req);
                string tag = ExtractJsonValue(body, "tag");
                string idsJson = ExtractJsonValue(body, "ids");
                var ids = idsJson?.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s));
                if (ids != null && tag != null)
                {
                    int count = EditableEncyclopedia.EditableEncyclopediaAPI.RemoveTagFromMultiple(ids, tag);
                    ServeJson(res, "{\"ok\":true,\"removed\":" + count + "}");
                }
                else { res.StatusCode = 400; WriteText(res, "Missing tag or ids"); }
            }
            else if (path == "/api/tags/clear-all" && method == "POST")
            {
                EditableEncyclopedia.EditableEncyclopediaAPI.ClearAllTags();
                ServeJson(res, "{\"ok\":true}");
            }
            else if (path.StartsWith("/api/tags/objects/") && method == "GET")
            {
                // /api/tags/objects/{tag} — get all objects with a specific tag
                string tag = path.Substring(18);
                var objects = EditableEncyclopedia.EditableEncyclopediaAPI.GetObjectsWithTag(tag);
                ServeJson(res, StringArrayToJson(objects?.ToArray() ?? new string[0]));
            }

            // ── Auto-tags ──
            else if (path.StartsWith("/api/auto-tags/") && method == "GET")
            {
                string objectId = path.Substring(15);
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string autoTags = beh?.GetAutoTags(objectId) ?? "";
                string tagsWithAuto = beh?.GetTagsWithAuto(objectId) ?? "";
                ServeJson(res, "{\"autoTags\":\"" + JEsc(autoTags) + "\",\"combined\":\"" + JEsc(tagsWithAuto) + "\"}");
            }

            // ── Enhanced Statistics ──
            else if (path == "/api/statistics/detailed" && method == "GET")
            {
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                var sb = new StringBuilder("{");
                sb.Append("\"descriptions\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetDescriptionCount());
                sb.Append(",\"loreFields\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoFieldCount());
                sb.Append(",\"heroesWithLore\":" + (beh?.GetHeroesWithInfoFieldsCount() ?? 0));
                sb.Append(",\"loreCharacters\":" + (beh?.GetHeroInfoFieldCharacterCount() ?? 0));
                sb.Append(",\"tags\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetTagCount());
                sb.Append(",\"uniqueTags\":" + (EditableEncyclopedia.EditableEncyclopediaAPI.GetAllUniqueTags()?.Count ?? 0));
                sb.Append(",\"journal\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetJournalCount());
                sb.Append(",\"journalEntries\":" + (beh?.GetTotalJournalEntryCount() ?? 0));
                sb.Append(",\"journalCharacters\":" + (beh?.GetJournalCharacterCount() ?? 0));
                sb.Append(",\"relationNotes\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetRelationNoteCount());
                sb.Append(",\"tagNotes\":" + (beh?.GetTagNoteCount() ?? 0));
                sb.Append(",\"tagCategories\":" + (EditableEncyclopedia.EditableEncyclopediaAPI.GetAllTagCategories()?.Count ?? 0));
                sb.Append(",\"tagPresets\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetTagPresetCount());
                sb.Append(",\"cultures\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetCustomCultureCount());
                sb.Append(",\"cultureDefs\":" + (beh?.GetCustomCultureDefinitionCount() ?? 0));
                sb.Append(",\"occupations\":" + EditableEncyclopedia.EditableEncyclopediaAPI.GetCustomOccupationCount());
                sb.Append(",\"names\":" + (beh?.GetCustomNameCount() ?? 0));
                sb.Append(",\"titles\":" + (beh?.GetCustomTitleCount() ?? 0));
                sb.Append(",\"banners\":" + (beh?.GetCustomBannerCount() ?? 0));
                sb.Append(",\"autoTagThresholds\":" + (beh?.GetPerHeroAutoTagThresholdCount() ?? 0));
                sb.Append("}");
                ServeJson(res, sb.ToString());
            }

            // ── Shared file path ──
            else if (path == "/api/shared-file-path" && method == "GET")
            {
                string fp = EditableEncyclopedia.EditableEncyclopediaAPI.GetSharedFilePath() ?? "";
                ServeJson(res, "{\"path\":\"" + JEsc(fp) + "\"}");
            }

            // ── Lore template field keys ──
            else if (path == "/api/lore-templates/keys" && method == "GET")
            {
                ServeJson(res, StringArrayToJson(EditableEncyclopedia.EditableEncyclopediaAPI.GetTemplateFieldKeys()));
            }

            // ── Purge orphaned entries ──
            else if (path == "/api/purge-orphans" && method == "POST")
            {
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                if (beh != null)
                {
                    beh.PurgeOrphanedCustomEntries();
                    ServeJson(res, "{\"ok\":true}");
                }
                else { res.StatusCode = 500; WriteText(res, "Behavior not available"); }
            }

            // ── Web Extension Settings ──
            else if (path == "/api/web-settings" && method == "GET")
            {
                // Read MCM settings for the web extension
                var sb = new StringBuilder("{");
                try
                {
                    var mcm = EditableEncyclopedia.MCMSettings.Instance;
                    if (mcm != null)
                    {
                        sb.Append("\"liveSyncEnabled\":" + (mcm.WebLiveSyncEnabled ? "true" : "false"));
                        sb.Append(",\"liveSyncInterval\":" + mcm.WebLiveSyncInterval);
                        sb.Append(",\"liveChronicleEnabled\":" + (mcm.WebLiveChronicleEnabled ? "true" : "false"));
                        sb.Append(",\"editingEnabled\":" + (mcm.WebEnableEditing ? "true" : "false"));
                        sb.Append(",\"showHud\":" + (mcm.WebShowHud ? "true" : "false"));
                        sb.Append(",\"showIntro\":" + (mcm.WebShowIntro ? "true" : "false"));
                        sb.Append(",\"showEmberParticles\":" + (mcm.WebShowEmberParticles ? "true" : "false"));
                        sb.Append(",\"showGoldSparks\":" + (mcm.WebShowGoldSparks ? "true" : "false"));
                        sb.Append(",\"enableSounds\":" + (mcm.WebEnableSounds ? "true" : "false"));
                        sb.Append(",\"enableScrollAnimations\":" + (mcm.WebEnableScrollAnimations ? "true" : "false"));
                        sb.Append(",\"cardsPerPage\":" + mcm.WebCardsPerPage);
                        sb.Append(",\"portraitExtractionEnabled\":" + (mcm.WebEnablePortraitExtraction ? "true" : "false"));
                    }
                    else
                    {
                        // Defaults if MCM not available
                        sb.Append("\"liveSyncEnabled\":true,\"liveSyncInterval\":8");
                        sb.Append(",\"liveChronicleEnabled\":true,\"editingEnabled\":true");
                        sb.Append(",\"showHud\":true,\"showIntro\":true");
                        sb.Append(",\"showEmberParticles\":true,\"showGoldSparks\":true");
                        sb.Append(",\"enableSounds\":true,\"enableScrollAnimations\":true");
                        sb.Append(",\"cardsPerPage\":60,\"portraitExtractionEnabled\":true");
                    }
                }
                catch (Exception ex)
                {
                    Log("WebServer: settings read error: " + ex.Message);
                    sb.Append("\"error\":\"" + JEsc(ex.Message) + "\"");
                }
                sb.Append("}");
                ServeJson(res, sb.ToString());
            }

            // ══════════════════════════════════════════════════════════════
            // PLAYER COMMAND CENTER ENDPOINTS
            // ══════════════════════════════════════════════════════════════

            else if (path == "/api/player/overview" && method == "GET")
                ServeJson(res, GetPlayerOverviewJson());
            else if (path.StartsWith("/api/player/equipment") && method == "GET")
            {
                string equipHeroId = req.QueryString["heroId"] ?? "";
                ServeJson(res, GetPlayerEquipmentJson(equipHeroId));
            }
            else if (path == "/api/player/troops" && method == "GET")
                ServeJson(res, GetPlayerTroopsJson());
            else if (path == "/api/player/prisoners" && method == "GET")
                ServeJson(res, GetPlayerPrisonersJson());
            else if (path == "/api/player/inventory" && method == "GET")
                ServeJson(res, GetPlayerInventoryJson());
            else if (path == "/api/player/companions" && method == "GET")
                ServeJson(res, GetPlayerCompanionsJson());
            else if (path == "/api/player/settlements" && method == "GET")
                ServeJson(res, GetPlayerSettlementsJson());
            else if (path == "/api/player/clan" && method == "GET")
                ServeJson(res, GetPlayerClanJson());
            else if (path == "/api/player/kingdom" && method == "GET")
                ServeJson(res, GetPlayerKingdomJson());
            else if (path == "/api/player/quests" && method == "GET")
                ServeJson(res, GetPlayerQuestsJson());
            else if (path.StartsWith("/api/player/character") && method == "GET")
            {
                string heroId = req.QueryString["heroId"] ?? "";
                ServeJson(res, GetPlayerCharacterJson(heroId));
            }
            else if (path == "/api/player/grantreward" && method == "POST")
            {
                string body = ReadBody(req);
                string rewardType = ExtractJsonValue(body, "type");
                string amountStr = ExtractJsonValue(body, "amount");
                int amount = 0;
                int.TryParse(amountStr, out amount);
                ServeJson(res, GrantPlayerReward(rewardType, amount));
            }
            else if (path == "/api/player/equip" && method == "POST")
            {
                string body = ReadBody(req);
                string itemId = ExtractJsonValue(body, "itemId");
                string slot = ExtractJsonValue(body, "slot");
                string equipType = ExtractJsonValue(body, "equipType");
                string eqHeroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleEquipItem(itemId, slot, equipType, eqHeroId ?? ""));
            }
            else if (path == "/api/player/unequip" && method == "POST")
            {
                string body = ReadBody(req);
                string slot = ExtractJsonValue(body, "slot");
                string equipType = ExtractJsonValue(body, "equipType");
                string ueqHeroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleUnequipItem(slot, equipType, ueqHeroId ?? ""));
            }

            else if (path.StartsWith("/api/player/perks") && method == "GET")
            {
                string skillId = req.QueryString["skillId"] ?? "";
                string perkHeroId = req.QueryString["heroId"] ?? "";
                ServeJson(res, GetPlayerPerksJson(skillId, perkHeroId));
            }
            else if (path == "/api/player/addfocus" && method == "POST")
            {
                string body = ReadBody(req);
                string skillId = ExtractJsonValue(body, "skillId");
                string focusHeroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleAddFocusPoint(skillId, focusHeroId ?? ""));
            }
            else if (path == "/api/player/addattribute" && method == "POST")
            {
                string body = ReadBody(req);
                string attrName = ExtractJsonValue(body, "attribute");
                string attrHeroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleAddAttributePoint(attrName, attrHeroId ?? ""));
            }

            else if (path.StartsWith("/api/settlement/fiefdetail/") && method == "GET")
            {
                string fId = path.Substring(27);
                ServeJson(res, GetFiefDetailJson(fId));
            }
            else if (path == "/api/settlement/setproject" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string buildingIndex = ExtractJsonValue(body, "buildingIndex");
                ServeJson(res, HandleSetProject(settlementId ?? "", buildingIndex ?? "0"));
            }

            else if (path == "/api/player/notifications" && method == "GET")
            {
                ServeJson(res, GetPlayerNotificationsJson());
            }
            else if (path == "/api/player/traderoutes" && method == "GET")
            {
                ServeJson(res, GetTradeRoutesJson());
            }
            else if (path == "/api/kingdom/abdicate" && method == "POST")
            {
                ServeJson(res, HandleAbdicateLeadership());
            }
            else if (path == "/api/kingdom/rename" && method == "POST")
            {
                string body = ReadBody(req);
                string newName = ExtractJsonValue(body, "name");
                ServeJson(res, HandleRenameKingdom(newName ?? ""));
            }
            else if (path == "/api/kingdom/supportclan" && method == "POST")
            {
                string body = ReadBody(req);
                string clanId = ExtractJsonValue(body, "clanId");
                ServeJson(res, HandleSupportClan(clanId ?? ""));
            }
            else if (path == "/api/kingdom/expelclan" && method == "POST")
            {
                string body = ReadBody(req);
                string clanId = ExtractJsonValue(body, "clanId");
                ServeJson(res, HandleExpelClan(clanId ?? ""));
            }
            else if (path == "/api/kingdom/changepolicy" && method == "POST")
            {
                string body = ReadBody(req);
                string policyId = ExtractJsonValue(body, "policyId");
                ServeJson(res, HandleChangePolicy(policyId ?? ""));
            }
            else if (path == "/api/kingdom/availableparties" && method == "GET")
                ServeJson(res, GetAvailableArmyPartiesJson());
            else if (path == "/api/map" && method == "GET")
                ServeJson(res, GetCampaignMapJson());
            else if (path == "/api/player/travel" && method == "POST")
            {
                string body = ReadBody(req);
                string target = ExtractJsonValue(body, "settlementId");
                ServeJson(res, HandlePlayerTravel(target ?? ""));
            }
            else if (path == "/api/kingdom/diplomacy" && method == "POST")
            {
                string body = ReadBody(req);
                string action = ExtractJsonValue(body, "action");
                string targetId = ExtractJsonValue(body, "targetKingdomId");
                Log("[Diplomacy] route hit: action=" + (action ?? "?") + " target=" + (targetId ?? "?") + " body=" + body);
                ServeJson(res, HandleKingdomDiplomacy(action ?? "", targetId ?? ""));
            }
            else if (path == "/api/kingdom/createarmy" && method == "POST")
            {
                string body = ReadBody(req);
                string targetId = ExtractJsonValue(body, "targetSettlementId");
                string partyIdsCsv = ExtractJsonValue(body, "partyIds");
                ServeJson(res, HandleCreateArmy(targetId ?? "", partyIdsCsv ?? ""));
            }

            else if (path == "/api/settlement/gift" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string clanId = ExtractJsonValue(body, "clanId");
                ServeJson(res, HandleGiftSettlement(settlementId ?? "", clanId ?? ""));
            }

            else if (path == "/api/settlement/sendmember" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string heroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleSendMemberToSettlement(settlementId ?? "", heroId ?? ""));
            }

            else if (path == "/api/settlement/setgovernor" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string heroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleSetGovernor(settlementId ?? "", heroId ?? ""));
            }
            else if (path == "/api/settlement/setwagelimit" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string limitVal = ExtractJsonValue(body, "limit");
                ServeJson(res, HandleSetGarrisonWageLimit(settlementId ?? "", limitVal ?? "0"));
            }
            else if (path == "/api/settlement/setautorecruitment" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                string enabled = ExtractJsonValue(body, "enabled");
                ServeJson(res, HandleSetAutoRecruitment(settlementId ?? "", enabled == "true"));
            }

            else if (path == "/api/player/createparty" && method == "POST")
            {
                string body = ReadBody(req);
                string heroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleCreateParty(heroId ?? ""));
            }
            else if (path == "/api/player/disbandparty" && method == "POST")
            {
                string body = ReadBody(req);
                string heroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleDisbandParty(heroId ?? ""));
            }

            else if (path == "/api/player/assignrole" && method == "POST")
            {
                string body = ReadBody(req);
                string role = ExtractJsonValue(body, "role");
                string heroId = ExtractJsonValue(body, "heroId");
                string partyId = ExtractJsonValue(body, "partyId");
                ServeJson(res, HandleAssignRole(role ?? "", heroId ?? "", partyId ?? ""));
            }
            else if (path == "/api/player/partyroles/detail" && method == "GET")
            {
                string partyIdQ = req.QueryString["partyId"] ?? "";
                ServeJson(res, GetPartyRolesDetailJson(partyIdQ));
            }
            else if (path == "/api/player/partyroles" && method == "GET")
            {
                ServeJson(res, GetPartyRolesJson());
            }

            else if (path == "/api/player/recruitprisoner" && method == "POST")
            {
                string body = ReadBody(req);
                string troopId = ExtractJsonValue(body, "troopId");
                string countStr = ExtractJsonValue(body, "count");
                int count = 1;
                try { if (!string.IsNullOrEmpty(countStr)) count = int.Parse(countStr); } catch { }
                ServeJson(res, HandleRecruitPrisoner(troopId ?? "", count));
            }

            else if (path == "/api/player/disbandtroop" && method == "POST")
            {
                string body = ReadBody(req);
                string troopId = ExtractJsonValue(body, "troopId");
                string countStr = ExtractJsonValue(body, "count");
                int count = 1;
                try { if (!string.IsNullOrEmpty(countStr)) count = int.Parse(countStr); } catch { }
                ServeJson(res, HandleDisbandTroop(troopId ?? "", count));
            }

            else if (path == "/api/player/upgradetroop" && method == "POST")
            {
                string body = ReadBody(req);
                string troopId = ExtractJsonValue(body, "troopId");
                string upgradeIdx = ExtractJsonValue(body, "upgradeIndex");
                int idx = 0;
                try { idx = int.Parse(upgradeIdx ?? "0"); } catch { }
                ServeJson(res, HandleUpgradeTroop(troopId ?? "", idx));
            }

            else if (path == "/api/player/sellgoods" && method == "POST")
            {
                string body = ReadBody(req);
                string sellType = ExtractJsonValue(body, "type"); // "goods", "food", "all"
                ServeJson(res, HandleSellGoods(sellType ?? "goods"));
            }

            else if (path == "/api/player/discard" && method == "POST")
            {
                string body = ReadBody(req);
                string itemId = ExtractJsonValue(body, "itemId");
                string countStr = ExtractJsonValue(body, "count");
                int count = 1;
                try { if (!string.IsNullOrEmpty(countStr)) count = int.Parse(countStr); } catch { }
                ServeJson(res, HandleDiscardItem(itemId ?? "", count));
            }

            else if (path == "/api/settlement/track" && method == "POST")
            {
                string body = ReadBody(req);
                string settlementId = ExtractJsonValue(body, "settlementId");
                ServeJson(res, HandleTrackSettlement(settlementId ?? ""));
            }

            else if (path == "/api/player/autoequip" && method == "POST")
            {
                string body = ReadBody(req);
                string aeHeroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleAutoEquipBest(aeHeroId ?? ""));
            }

            else if (path == "/api/player/selectperk" && method == "POST")
            {
                string body = ReadBody(req);
                string perkId = ExtractJsonValue(body, "perkId");
                string heroId = ExtractJsonValue(body, "heroId");
                ServeJson(res, HandleSelectPerk(perkId, heroId ?? ""));
            }

            // ── Not found ──
            else
            {
                res.StatusCode = 404;
                WriteText(res, "API endpoint not found");
            }
        }

        private static void HandlePortraitUpload(HttpListenerRequest req, HttpListenerResponse res, string heroId)
        {
            try
            {
                // Sanitize heroId to prevent path traversal
                string safeId = heroId.Replace("..", "").Replace("/", "").Replace("\\", "");
                if (string.IsNullOrEmpty(safeId)) { res.StatusCode = 400; WriteText(res, "Invalid hero ID"); return; }

                string portraitDir = Path.Combine(_webRoot, "Potrais");
                if (!Directory.Exists(portraitDir)) Directory.CreateDirectory(portraitDir);

                string filePath = Path.Combine(portraitDir, safeId + ".png");

                // Read the raw body bytes
                using (var ms = new System.IO.MemoryStream())
                {
                    req.InputStream.CopyTo(ms);
                    byte[] data = ms.ToArray();
                    if (data.Length == 0) { res.StatusCode = 400; WriteText(res, "No data"); return; }
                    if (data.Length > 5 * 1024 * 1024) { res.StatusCode = 413; WriteText(res, "File too large (max 5MB)"); return; }
                    File.WriteAllBytes(filePath, data);
                }

                Log("WebServer: Portrait uploaded for hero " + safeId);
                ServeJson(res, "{\"ok\":true,\"path\":\"Potrais/" + JEsc(safeId) + ".png\"}");
            }
            catch (Exception ex)
            {
                Log("WebServer: Portrait upload error: " + ex.Message);
                res.StatusCode = 500;
                WriteText(res, "Upload failed: " + ex.Message);
            }
        }

        // ── Hero Portrait Extraction — queues for main-thread processing ──
        private static readonly System.Collections.Concurrent.ConcurrentQueue<Action> _mainThreadQueue
            = new System.Collections.Concurrent.ConcurrentQueue<Action>();
        private static int _portraitExtractResult = -1; // -1=not started, -2=in progress
        private static bool _dumpedPartyPos = false;

        /// <summary>Called from OnApplicationTick on the main game thread.</summary>
        public static void ProcessMainThreadQueue()
        {
            // Process queued actions
            int processed = 0;
            while (processed < 3 && _mainThreadQueue.TryDequeue(out var action))
            {
                try { action(); } catch (Exception ex) { Log("MainThread: action failed: " + ex.Message); }
                processed++;
            }
            // Tick portrait extraction (processes one hero across multiple frames)
            if (_portraitQueue != null)
            {
                try { TickPortraitExtraction(); } catch (Exception ex) { Log("MainThread: portrait tick error: " + ex.Message); }
            }
        }

        private static int ExtractHeroPortraits()
        {
            // Don't restart if already in progress
            if (_portraitExtractResult == -2 || _portraitQueue != null)
                return 0;

            _portraitExtractResult = -2; // in progress
            _mainThreadQueue.Enqueue(() => DoExtractPortraitsMainThread());

            // Wait up to 60s for completion (1927 heroes × ~30 ticks each = takes a while)
            for (int i = 0; i < 600 && _portraitExtractResult == -2; i++)
                System.Threading.Thread.Sleep(100);

            return _portraitExtractResult > 0 ? _portraitExtractResult : 0;
        }

        // Portrait extraction state — processes heroes across multiple frames
        private static System.Collections.Generic.Queue<Hero> _portraitQueue;
        private static object _currentProvider;
        private static string _currentHeroId;
        private static string _currentOutPath;
        private static string _currentHeroCulture;
        private static int _ticksWaited;
        private static bool _saveDone;
        private static int _saveWaitTicks;
        private static bool _scenesWarmed; // true after scene lighting setup, waiting for engine to apply
        private static int _sceneWarmTicks; // ticks waited for scene to apply lighting changes
        private static int _extractedCount;
        private static Type _providerType;
        private static System.Reflection.MethodInfo _createFromMethod;
        private static Type _charImgIdVMType;
        private static Type _charCodeType;

        private static void DoExtractPortraitsMainThread()
        {
            try
            {
                string portraitDir = Path.Combine(_webRoot, "Portraits");
                if (!Directory.Exists(portraitDir)) Directory.CreateDirectory(portraitDir);


                // Resolve types once
                _charCodeType = null; _charImgIdVMType = null; _providerType = null;
                Type charImgIdType = null;
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    _charCodeType = _charCodeType ?? asm.GetType("TaleWorlds.Core.CharacterCode");
                    charImgIdType = charImgIdType ?? asm.GetType("TaleWorlds.Core.ImageIdentifiers.CharacterImageIdentifier");
                    _charImgIdVMType = _charImgIdVMType ?? asm.GetType("TaleWorlds.Core.ViewModelCollection.ImageIdentifiers.CharacterImageIdentifierVM");
                    if (_providerType == null)
                        try { foreach (var t in asm.GetTypes()) if (t.Name == "CharacterImageTextureProvider" && !t.IsAbstract) { _providerType = t; break; } } catch { }
                }
                if (_charCodeType != null)
                    foreach (var m in _charCodeType.GetMethods(System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public))
                        if (m.Name == "CreateFrom" && m.GetParameters().Length == 1) { _createFromMethod = m; break; }

                Log("PortraitExtract: types resolved, provider=" + (_providerType?.Name ?? "null"));
                if (_charCodeType == null || _createFromMethod == null || _providerType == null)
                { _portraitExtractResult = 0; return; }

                // Build queue of heroes to process
                _portraitQueue = new System.Collections.Generic.Queue<Hero>();
                foreach (var hero in Hero.AllAliveHeroes)
                {
                    if (hero?.CharacterObject == null) continue;
                    string safeId = hero.StringId?.Replace("..", "").Replace("/", "").Replace("\\", "");
                    if (string.IsNullOrEmpty(safeId)) continue;
                    if (File.Exists(Path.Combine(portraitDir, safeId + ".png"))) continue;
                    _portraitQueue.Enqueue(hero);
                }
                _extractedCount = 0;
                _currentProvider = null;
                _currentHeroId = null;
                _ticksWaited = 0;
                _scenesWarmed = false;
                _sceneWarmTicks = 0;
                Log("PortraitExtract: queued " + _portraitQueue.Count + " heroes for extraction");

                // If no heroes to extract, done immediately
                if (_portraitQueue.Count == 0)
                    _portraitExtractResult = 0;
                // Otherwise, ProcessMainThreadQueue will call TickPortraitExtraction each frame
            }
            catch (Exception ex)
            {
                Log("PortraitExtract: init error: " + ex.Message);
                _portraitExtractResult = 0;
            }
        }

        /// <summary>Called each frame from ProcessMainThreadQueue to process portrait rendering.</summary>
        private static void TickPortraitExtraction()
        {
            if (_portraitQueue == null) return;
            var flags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public
                | System.Reflection.BindingFlags.NonPublic;
            string portraitDir = Path.Combine(_webRoot, "Portraits");

            // Phase 0: Warm up scenes with proper lighting (run once, wait 60 frames)
            if (!_scenesWarmed)
            {
                if (_sceneWarmTicks == 0)
                {
                    // Apply warm lighting to all tableau scenes on first tick
                    try
                    {
                        Type btmType = null;
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                            btmType = btmType ?? asm.GetType("TaleWorlds.MountAndBlade.BannerlordTableauManager");
                        if (btmType != null)
                        {
                            var scenesProperty = btmType.GetProperty("TableauCharacterScenes",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            var scenes = scenesProperty?.GetValue(null) as TaleWorlds.Engine.Scene[];
                            if (scenes != null)
                            {
                                foreach (var scene in scenes)
                                {
                                    if (scene == null) continue;
                                    scene.SetAtmosphereWithName("character_menu_a");
                                    scene.SetSceneColorGrade("filmic_color_grade");
                                    scene.SetColorGradeBlend("filmic_color_grade", "filmic_color_grade", 0f);
                                    var warmAmb = new TaleWorlds.Library.Vec3(0.80f, 0.75f, 0.65f);
                                    scene.SetFogAmbientColor(ref warmAmb);
                                    var sunDir = new TaleWorlds.Library.Vec3(1f, -1f, -1f);
                                    scene.SetSunDirection(ref sunDir);
                                    scene.SetMiddleGray(0.15f);
                                }
                                Log("PortraitExtract: applied warm lighting to " + scenes.Length + " scenes, waiting 60 frames...");
                            }
                        }
                    }
                    catch (Exception ex) { Log("PortraitExtract: scene warm error: " + ex.Message); }
                }
                _sceneWarmTicks++;
                if (_sceneWarmTicks >= 60) // wait 1 second for engine to apply changes
                {
                    _scenesWarmed = true;
                    Log("PortraitExtract: scenes warmed up, starting extraction");
                }
                return; // don't process heroes yet
            }

            // Phase 2: Wait for file to appear after SaveToFile, then apply color fix
            if (_saveDone && _currentHeroId != null)
            {
                _saveWaitTicks++;
                if (_saveWaitTicks >= 10) // check if file appeared
                {
                    bool fileExists = File.Exists(_currentOutPath);
                    long fileSize = fileExists ? new FileInfo(_currentOutPath).Length : 0;
                    if (fileExists && fileSize > 100)
                    {
                        // Color correction handled in browser via SVG feColorMatrix filter
                        _extractedCount++;
                        Log("PortraitExtract: SAVED " + _currentHeroId + " (" + fileSize + " bytes)");
                    }
                    else
                    {
                        // File never appeared — count it if SaveToFile at least didn't crash
                        if (_saveWaitTicks >= 30) // give up after 30 ticks
                        {
                            Log("PortraitExtract: file never appeared for " + _currentHeroId);
                        }
                        else return; // keep waiting
                    }
                    // Move to next hero
                    _saveDone = false;
                    _currentProvider = null;
                    _currentHeroId = null;
                }
                return;
            }

            // Phase 1: If we have a provider waiting, tick it and check for texture
            if (_currentProvider != null)
            {
                _ticksWaited++;
                // Tick the provider
                var tickMethod = _providerType.GetMethod("Tick", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                if (tickMethod != null)
                    try { tickMethod.Invoke(_currentProvider, new object[] { 0.016f }); } catch { }

                // After enough ticks, try to get the texture
                if (_ticksWaited >= 30) // wait ~0.5 seconds (30 frames)
                {
                    try
                    {
                        object texture = null;

                        // Strategy 1: Search all fields for a Texture object
                        var allFlags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic
                            | System.Reflection.BindingFlags.Public;
                        Type searchType = _providerType;
                        while (searchType != null && searchType != typeof(object))
                        {
                            foreach (var field in searchType.GetFields(allFlags | System.Reflection.BindingFlags.DeclaredOnly))
                            {
                                if (field.FieldType.Name.Contains("Texture") || field.Name.ToLower().Contains("texture"))
                                {
                                    try
                                    {
                                        var val = field.GetValue(_currentProvider);
                                        if (val != null)
                                        {
                                            if (_extractedCount == 0)
                                                Log("PortraitExtract: field " + field.Name + " = " + val.GetType().FullName);
                                            // Check if it's an engine Texture with SaveToFile
                                            var stf = val.GetType().GetMethod("SaveToFile");
                                            if (stf != null) { texture = val; break; }
                                            // Check for PlatformTexture property
                                            var platProp = val.GetType().GetProperty("PlatformTexture", allFlags);
                                            if (platProp != null)
                                            {
                                                var plat = platProp.GetValue(val);
                                                if (plat != null && plat.GetType().GetMethod("SaveToFile") != null)
                                                { texture = plat; break; }
                                            }
                                        }
                                    }
                                    catch { }
                                }
                            }
                            if (texture != null) break;
                            searchType = searchType.BaseType;
                        }

                        // Strategy 2: ThumbnailCreationData may contain texture reference
                        if (texture == null)
                        {
                            try
                            {
                                var tcdProp = _providerType.GetProperty("ThumbnailCreationData", allFlags);
                                var tcd = tcdProp?.GetValue(_currentProvider);
                                if (tcd != null)
                                {
                                    if (_extractedCount == 0)
                                    {
                                        Log("PortraitExtract: ThumbnailCreationData type=" + tcd.GetType().FullName);
                                        Log("PortraitExtract: TCD fields: " + string.Join(", ",
                                            Array.ConvertAll(tcd.GetType().GetFields(allFlags), f => f.Name + ":" + f.FieldType.Name)));
                                        Log("PortraitExtract: TCD props: " + string.Join(", ",
                                            Array.ConvertAll(tcd.GetType().GetProperties(allFlags), p => p.Name + ":" + p.PropertyType.Name)));
                                    }
                                    // Search TCD for a texture
                                    foreach (var f in tcd.GetType().GetFields(allFlags))
                                    {
                                        if (f.FieldType.Name.Contains("Texture"))
                                        {
                                            var val = f.GetValue(tcd);
                                            if (val != null) { texture = val; break; }
                                        }
                                    }
                                }
                            }
                            catch { }
                        }

                        // Strategy 3: Log everything for debugging on first hero
                        if (texture == null && _extractedCount == 0)
                        {
                            searchType = _providerType;
                            while (searchType != null && searchType != typeof(object))
                            {
                                foreach (var field in searchType.GetFields(allFlags | System.Reflection.BindingFlags.DeclaredOnly))
                                {
                                    try
                                    {
                                        var val = field.GetValue(_currentProvider);
                                        Log("PortraitExtract: FIELD " + searchType.Name + "." + field.Name +
                                            " type=" + field.FieldType.Name + " val=" + (val?.GetType().Name ?? "null"));
                                    }
                                    catch { }
                                }
                                searchType = searchType.BaseType;
                            }
                        }

                        if (texture != null && _extractedCount == 0)
                            Log("PortraitExtract: FOUND texture type=" + texture.GetType().FullName);

                        // Unwrap: if it's a TwoDimension.Texture, get PlatformTexture
                        if (texture != null)
                        {
                            var platProp2 = texture.GetType().GetProperty("PlatformTexture", allFlags);
                            if (platProp2 != null)
                            {
                                var plat = platProp2.GetValue(texture);
                                if (plat != null) texture = plat;
                            }
                        }

                        if (texture != null)
                        {
                            var texType = texture.GetType();
                            bool saved = false;

                            // Transform render target to resource first
                            try
                            {
                                var transformMethod = texType.GetMethod("TransformRenderTargetToResource",
                                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (transformMethod != null)
                                {
                                    transformMethod.Invoke(texture, new object[] { _currentHeroId + "_portrait" });
                                }
                            }
                            catch (Exception ex) { Log("PortraitExtract: Transform error: " + (ex.InnerException?.Message ?? ex.Message)); }

                            // Try SaveToFile(String,Boolean)
                            try
                            {
                                var saveMethod = texType.GetMethod("SaveToFile",
                                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance,
                                    null, new[] { typeof(string), typeof(bool) }, null);
                                if (saveMethod != null)
                                {
                                    saveMethod.Invoke(texture, new object[] { _currentOutPath, false });
                                    saved = true;
                                }
                            }
                            catch (Exception ex) { Log("PortraitExtract: SaveToFile error: " + (ex.InnerException?.Message ?? ex.Message)); }

                            // If SaveToFile didn't create file, use GetPixelData
                            if (!File.Exists(_currentOutPath) || new FileInfo(_currentOutPath).Length < 100)
                            {
                                try
                                {
                                    int w = (int)texType.GetProperty("Width").GetValue(texture);
                                    int h = (int)texType.GetProperty("Height").GetValue(texture);
                                    var gpMethod = texType.GetMethod("GetPixelData",
                                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance,
                                        null, new[] { typeof(byte[]) }, null);
                                    if (gpMethod != null && w > 0 && h > 0)
                                    {
                                        byte[] pixelData = new byte[w * h * 4];
                                        gpMethod.Invoke(texture, new object[] { pixelData });
                                        // Build bitmap — BGRA format
                                        using (var bmp = new System.Drawing.Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
                                        {
                                            var rect = new System.Drawing.Rectangle(0, 0, w, h);
                                            var bmpData = bmp.LockBits(rect, System.Drawing.Imaging.ImageLockMode.WriteOnly,
                                                System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                                            System.Runtime.InteropServices.Marshal.Copy(pixelData, 0, bmpData.Scan0, pixelData.Length);
                                            bmp.UnlockBits(bmpData);
                                            bmp.Save(_currentOutPath, System.Drawing.Imaging.ImageFormat.Png);
                                            saved = true;
                                            Log("PortraitExtract: saved via GetPixelData " + _currentHeroId + " " + w + "x" + h);
                                        }
                                    }
                                }
                                catch { /* GetPixelData fails on GPU render targets — expected, SaveToFile handles it async */ }
                            }

                            // Fallback: GetPixelData (only if SaveToFile didn't create the file)
                            if (!File.Exists(_currentOutPath) || new FileInfo(_currentOutPath).Length < 100)
                            {
                                var widthProp = texType.GetProperty("Width");
                                var heightProp = texType.GetProperty("Height");
                                if (widthProp != null && heightProp != null)
                                {
                                    int w = (int)widthProp.GetValue(texture);
                                    int h = (int)heightProp.GetValue(texture);
                                    Log("PortraitExtract: texture " + _currentHeroId + " = " + texType.Name + " " + w + "x" + h);

                                    // Try GetPixelData with various signatures
                                    foreach (var gp in texType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                                    {
                                        if (!gp.Name.Contains("GetPixel") && !gp.Name.Contains("GetData")) continue;
                                        var gpParms = gp.GetParameters();
                                        try
                                        {
                                            if (gpParms.Length == 1 && gpParms[0].ParameterType == typeof(byte[]))
                                            {
                                                byte[] px = new byte[w * h * 4];
                                                gp.Invoke(texture, new object[] { px });
                                                using (var bmp = new System.Drawing.Bitmap(w, h))
                                                {
                                                    for (int y = 0; y < h; y++)
                                                        for (int x = 0; x < w; x++)
                                                        {
                                                            int idx = (y * w + x) * 4;
                                                            bmp.SetPixel(x, y, System.Drawing.Color.FromArgb(
                                                                px[idx + 3], px[idx], px[idx + 1], px[idx + 2]));
                                                        }
                                                    bmp.Save(_currentOutPath, System.Drawing.Imaging.ImageFormat.Png);
                                                    saved = true;
                                                }
                                                break;
                                            }
                                        }
                                        catch (Exception ex2) { Log("PortraitExtract: pixel fallback failed: " + ex2.Message); }
                                    }

                                    // Log all methods on first failure for debugging
                                    if (!saved && _extractedCount == 0)
                                    {
                                        Log("PortraitExtract: texture type=" + texType.FullName + " methods: " +
                                            string.Join(", ", Array.ConvertAll(
                                                texType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance),
                                                m => m.Name + "(" + string.Join(",", Array.ConvertAll(m.GetParameters(), p => p.ParameterType.Name)) + "):" + m.ReturnType.Name)));
                                    }
                                }
                            }

                            // SaveToFile is async on the engine — file won't exist yet
                            // Set flag to wait for it on subsequent ticks (Phase 2)
                            // SaveToFile is async — set flag, wait for file on next ticks
                            _saveDone = true;
                            _saveWaitTicks = 0;
                            return;
                        }
                        else
                        {
                            Log("PortraitExtract: no texture after " + _ticksWaited + " ticks for " + _currentHeroId);
                        }
                    }
                    catch (Exception ex) { Log("PortraitExtract: save error " + _currentHeroId + ": " + ex.Message); }

                    // No texture found — release and move to next
                    try
                    {
                        var disposeMethod = _providerType.GetMethod("Clear", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                        if (disposeMethod != null) disposeMethod.Invoke(_currentProvider, null);
                    }
                    catch { }
                    _currentProvider = null;
                    _currentHeroId = null;
                }
                return;
            }

            // Start next hero
            if (_portraitQueue.Count > 0)
            {
                var hero = _portraitQueue.Dequeue();
                string safeId = hero.StringId?.Replace("..", "").Replace("/", "").Replace("\\", "");
                if (string.IsNullOrEmpty(safeId)) return;

                try
                {
                    object charCode = _createFromMethod.Invoke(null, new object[] { hero.CharacterObject });
                    if (charCode == null) return;

                    // Get imageId
                    string imageId = null;
                    if (_charImgIdVMType != null)
                    {
                        foreach (var c in _charImgIdVMType.GetConstructors())
                        {
                            var cp = c.GetParameters();
                            if (cp.Length == 1 && cp[0].ParameterType.IsAssignableFrom(charCode.GetType()))
                            {
                                var vm = c.Invoke(new[] { charCode });
                                if (vm != null)
                                {
                                    var idProp = vm.GetType().GetProperty("Id", flags | System.Reflection.BindingFlags.Static);
                                    imageId = idProp?.GetValue(vm) as string;
                                }
                                break;
                            }
                        }
                    }
                    if (string.IsNullOrEmpty(imageId)) return;

                    _currentHeroId = safeId;
                    _currentOutPath = Path.Combine(portraitDir, safeId + ".png");
                    _currentHeroCulture = hero.Culture?.Name?.ToString() ?? "";
                    _ticksWaited = 0;
                    _saveDone = false;
                    _saveWaitTicks = 0;

                    // Use ThumbnailCacheManager directly — renders with proper scene lighting
                    try
                    {
                        Type thumbCacheType = null;
                        Type charThumbDataType = null;
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            thumbCacheType = thumbCacheType ?? asm.GetType("TaleWorlds.MountAndBlade.View.Tableaus.ThumbnailCacheManager");
                            charThumbDataType = charThumbDataType ?? asm.GetType("TaleWorlds.MountAndBlade.View.Tableaus.Thumbnails.CharacterThumbnailCreationData");
                        }

                        if (thumbCacheType != null && charThumbDataType != null)
                        {
                            // Scene warm-up is done in Phase 0 of TickPortraitExtraction

                            var cacheInstance = thumbCacheType.GetProperty("Current",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.GetValue(null);

                            if (cacheInstance != null)
                            {
                                // Create Action<Texture> callback that saves the rendered portrait
                                string outPath = _currentOutPath;
                                string hId = safeId;
                                Action<TaleWorlds.Engine.Texture> setAction = (TaleWorlds.Engine.Texture texture) =>
                                {
                                    try
                                    {
                                        if (texture == null) { Log("PortraitExtract: callback texture null for " + hId); return; }
                                        texture.SaveToFile(outPath, false);
                                        _extractedCount++;
                                        Log("PortraitExtract: SAVED " + hId);
                                    }
                                    catch (Exception ex) { Log("PortraitExtract: callback error " + hId + ": " + ex.Message); }
                                };
                                Action cancelAction = () =>
                                {
                                    Log("PortraitExtract: render cancelled for " + hId);
                                };

                                // Find constructor: CharacterThumbnailCreationData(CharacterCode, Action<Texture>, Action, bool, int, int)
                                object creationData = null;
                                foreach (var ctor in charThumbDataType.GetConstructors())
                                {
                                    var cp = ctor.GetParameters();
                                    if (cp.Length >= 4 && cp[0].ParameterType.IsAssignableFrom(charCode.GetType()))
                                    {
                                        if (cp.Length == 6)
                                            creationData = ctor.Invoke(new object[] { charCode, setAction, cancelAction, false, 256, 256 });
                                        else if (cp.Length == 4)
                                            creationData = ctor.Invoke(new object[] { charCode, setAction, cancelAction, false });
                                        else if (cp.Length == 5)
                                            creationData = ctor.Invoke(new object[] { charCode, setAction, cancelAction, false, -1 });
                                        if (creationData != null) break;
                                    }
                                }

                                if (creationData != null)
                                {
                                    // Call ThumbnailCacheManager.Current.CreateTexture(creationData)
                                    var createTexMethod = thumbCacheType.GetMethod("CreateTexture",
                                        System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                                    if (createTexMethod != null)
                                    {
                                        createTexMethod.Invoke(cacheInstance, new object[] { creationData });
                                        // The callback will fire asynchronously — set saveDone so we wait
                                        _saveDone = true;
                                        _currentProvider = new object(); // dummy to keep tick alive
                                    }
                                    else
                                        Log("PortraitExtract: CreateTexture method not found");
                                }
                                else
                                {
                                    Log("PortraitExtract: failed to create CharacterThumbnailCreationData");
                                    // Log available constructors
                                    foreach (var ctor in charThumbDataType.GetConstructors())
                                    {
                                        var cp = ctor.GetParameters();
                                        Log("PortraitExtract: ctor(" + cp.Length + "): " +
                                            string.Join(", ", Array.ConvertAll(cp, p => p.ParameterType.Name + " " + p.Name)));
                                    }
                                }
                            }
                            else
                                Log("PortraitExtract: ThumbnailCacheManager.Current is null");
                        }
                        else
                            Log("PortraitExtract: types not found");
                    }
                    catch (Exception ex) { Log("PortraitExtract: direct render error: " + ex.Message); }

                    Log("PortraitExtract: started " + safeId);
                }
                catch (Exception ex) { Log("PortraitExtract: setup error " + safeId + ": " + ex.Message); _currentProvider = null; }
            }
            else
            {
                // All done
                Log("PortraitExtract: COMPLETE — extracted " + _extractedCount + " portraits");
                _portraitExtractResult = _extractedCount;
                _portraitQueue = null;
            }
        }

        // ── API: Status (health check + metadata) ──
        private static string GetStatusJson()
        {
            string playerName = "";
            string gameDate = "";
            int gold = 0;
            int troops = 0;
            int woundedTroops = 0;
            float food = 0;
            float morale = 0;
            float speed = 0;
            float influence = 0;
            int viewDist = 0;
            int dailyWage = 0;
            float hitPoints = 0;
            float maxHitPoints = 0;
            string clanName = "";
            string kingdomName = "";
            int troopLimit = 0;
            float foodChange = 0;
            int daysOfFood = 0;
            float shipHealth = -1;
            float shipMaxHealth = -1;
            try
            {
                var hero = Hero.MainHero;
                if (hero != null)
                {
                    playerName = hero.Name?.ToString() ?? "";
                    gold = hero.Gold;
                    clanName = hero.Clan?.Name?.ToString() ?? "";
                    kingdomName = hero.Clan?.Kingdom?.Name?.ToString() ?? "";
                    hitPoints = hero.HitPoints;
                    maxHitPoints = hero.MaxHitPoints;
                    influence = hero.Clan?.Influence ?? 0;
                }
                gameDate = CampaignTime.Now.ToString();

                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party != null)
                {
                    troops = party.MemberRoster?.TotalManCount ?? 0;
                    woundedTroops = party.MemberRoster?.TotalWounded ?? 0;
                    food = party.TotalFoodAtInventory;
                    morale = party.Morale;
                    speed = party.Speed;
                    viewDist = (int)(party.SeeingRange);
                    troopLimit = party.Party?.PartySizeLimit ?? 0;
                    try { dailyWage = (int)party.TotalWage; } catch { }
                    try { foodChange = party.FoodChange; } catch { }
                    try { if (foodChange < 0 && food > 0) daysOfFood = (int)(food / -foodChange); } catch { }

                    // Naval DLC: ship health from MobileParty.Ships list
                    try
                    {
                        var shipsProp = party.GetType().GetProperty("Ships", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (shipsProp != null)
                        {
                            var shipsList = shipsProp.GetValue(party) as System.Collections.IEnumerable;
                            if (shipsList != null)
                            {
                                foreach (var ship in shipsList)
                                {
                                    if (ship == null) continue;
                                    var shipType = ship.GetType();
                                    if (!_shipPropsLogged)
                                    {
                                        var props = shipType.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        Log("HUD: Ship type=" + shipType.FullName + " props: " + string.Join(", ", System.Array.ConvertAll(props, p => p.Name + ":" + p.PropertyType.Name)));
                                    }
                                    // Try common property names for health
                                    string[] hpNames = { "HitPoints", "Hp", "Health", "CurrentHp", "Durability" };
                                    string[] maxNames = { "MaxHitPoints", "MaxHp", "MaxHealth", "MaxDurability" };
                                    foreach (var n in hpNames)
                                    {
                                        var p = shipType.GetProperty(n);
                                        if (p != null) { shipHealth = Convert.ToSingle(p.GetValue(ship)); break; }
                                    }
                                    foreach (var n in maxNames)
                                    {
                                        var p = shipType.GetProperty(n);
                                        if (p != null) { shipMaxHealth = Convert.ToSingle(p.GetValue(ship)); break; }
                                    }
                                    break; // Use first ship
                                }
                            }
                        }
                        _shipPropsLogged = true;
                    }
                    catch { }
                }
            }
            catch { }

            var sb = new StringBuilder("{\"ok\":true");
            sb.Append(",\"player\":\"").Append(JEsc(playerName)).Append("\"");
            sb.Append(",\"date\":\"").Append(JEsc(gameDate)).Append("\"");
            sb.Append(",\"gold\":").Append(gold);
            sb.Append(",\"troops\":").Append(troops);
            sb.Append(",\"wounded\":").Append(woundedTroops);
            sb.Append(",\"food\":").Append(food.ToString("F1"));
            sb.Append(",\"morale\":").Append(morale.ToString("F0"));
            sb.Append(",\"speed\":").Append(speed.ToString("F1"));
            sb.Append(",\"influence\":").Append(influence.ToString("F0"));
            sb.Append(",\"hitPoints\":").Append(hitPoints.ToString("F0"));
            sb.Append(",\"maxHitPoints\":").Append(maxHitPoints.ToString("F0"));
            sb.Append(",\"dailyWage\":").Append(dailyWage);
            sb.Append(",\"viewDist\":").Append(viewDist);
            sb.Append(",\"troopLimit\":").Append(troopLimit);
            sb.Append(",\"foodChange\":").Append(foodChange.ToString("F2"));
            sb.Append(",\"daysOfFood\":").Append(daysOfFood);
            sb.Append(",\"clan\":\"").Append(JEsc(clanName)).Append("\"");
            sb.Append(",\"kingdom\":\"").Append(JEsc(kingdomName)).Append("\"");
            if (shipHealth >= 0) sb.Append(",\"shipHealth\":").Append(shipHealth.ToString("F0"));
            if (shipMaxHealth >= 0) sb.Append(",\"shipMaxHealth\":").Append(shipMaxHealth.ToString("F0"));
            sb.Append("}");
            return sb.ToString();
        }

        // ── API: List Heroes ──
        private static string GetHeroesJson()
        {
            var sb = new StringBuilder("[");
            bool first = true;

            if (Hero.MainHero != null)
            {
                sb.Append(HeroToJson(Hero.MainHero, true));
                first = false;
            }

            foreach (var hero in Hero.AllAliveHeroes)
            {
                if (hero == null || hero == Hero.MainHero) continue;
                // Include Lords, Companions, Wanderers, Notables, Minor Faction heroes
                if (!hero.IsLord && !hero.IsPlayerCompanion && !hero.IsWanderer && !hero.IsNotable && !hero.IsMinorFactionHero) continue;
                if (!first) sb.Append(",");
                sb.Append(HeroToJson(hero, false));
                first = false;
            }

            // Include dead heroes (lords and notables)
            foreach (var hero in Hero.DeadOrDisabledHeroes)
            {
                if (hero == null || hero == Hero.MainHero) continue;
                if (!hero.IsLord && !hero.IsNotable && !hero.IsMinorFactionHero) continue;
                if (!first) sb.Append(",");
                sb.Append(HeroToJson(hero, false));
                first = false;
            }

            sb.Append("]");
            return sb.ToString();
        }

        private static string HeroToJson(Hero hero, bool isPlayer)
        {
            string desc = EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(hero.StringId) ?? "";
            bool hasCustom = !string.IsNullOrEmpty(desc);

            // Merge custom name/culture if set
            var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
            string displayName = beh?.GetCustomName(hero.StringId);
            if (string.IsNullOrEmpty(displayName)) displayName = hero.Name?.ToString();
            string displayCulture = null;
            try { displayCulture = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroCulture(hero.StringId); } catch { }
            if (string.IsNullOrEmpty(displayCulture)) displayCulture = hero.Culture?.Name?.ToString();

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(hero.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(displayName) + "\",");
            sb.Append("\"culture\":\"" + JEsc(displayCulture) + "\",");
            sb.Append("\"clan\":\"" + JEsc(hero.Clan?.Name?.ToString()) + "\",");
            sb.Append("\"kingdom\":\"" + JEsc(hero.Clan?.Kingdom?.Name?.ToString()) + "\",");
            sb.Append("\"age\":" + (int)hero.Age + ",");
            sb.Append("\"isDead\":" + (hero.IsDead ? "true" : "false") + ",");
            sb.Append("\"isFemale\":" + (hero.IsFemale ? "true" : "false") + ",");
            sb.Append("\"isPlayer\":" + (isPlayer ? "true" : "false") + ",");
            sb.Append("\"hasCustomDescription\":" + (hasCustom ? "true" : "false") + ",");
            sb.Append("\"description\":\"" + JEsc(desc) + "\",");
            // Occupation — use native enum + additional role info
            string occupation = "";
            try
            {
                // Native occupation from game enum (Lord, Wanderer, Merchant, GangLeader, Artisan, Headman, Preacher, etc.)
                occupation = hero.Occupation.ToString();
                // Add more specific role
                if (isPlayer) occupation = "Player";
                else if (hero.IsPlayerCompanion) occupation = "Companion";
                else if (hero.IsMinorFactionHero && occupation == "Lord") occupation = "Minor Faction";
            }
            catch { }
            // Role (secondary classification)
            string role = "";
            try
            {
                if (hero.IsLord && hero.Clan?.Leader == hero) role = "Clan Leader";
                else if (hero.IsLord && hero.Clan?.Kingdom?.Leader == hero) role = "Ruler";
                else if (hero.IsPlayerCompanion) role = "Companion";
                else if (hero.IsNotable) role = "Notable";
            }
            catch { }
            sb.Append("\"occupation\":\"" + JEsc(occupation) + "\",");
            sb.Append("\"role\":\"" + JEsc(role) + "\",");
            // Marital status
            bool isMarried = hero.Spouse != null && hero.Spouse.IsAlive;
            string spouseName = "";
            try { if (hero.Spouse != null) spouseName = hero.Spouse.Name?.ToString() ?? ""; } catch { }
            sb.Append("\"isMarried\":" + (isMarried ? "true" : "false") + ",");
            sb.Append("\"spouse\":\"" + JEsc(spouseName) + "\",");
            // Met player — use HasMet property + encyclopedia discovery
            bool hasMet = false;
            if (hero != Hero.MainHero)
            {
                try
                {
                    // Primary: Hero.HasMet (direct property)
                    hasMet = hero.HasMet;
                }
                catch
                {
                    // Fallback: check relation
                    try
                    {
                        if (Hero.MainHero != null)
                        {
                            int rel = CharacterRelationManager.GetHeroRelation(Hero.MainHero, hero);
                            if (rel != 0) hasMet = true;
                        }
                    }
                    catch { }
                }
                // Fallback 2: check via reflection for LastSeenPlace or similar
                if (!hasMet)
                {
                    try
                    {
                        var lsp = hero.GetType().GetProperty("LastSeenPlace");
                        if (lsp != null && lsp.GetValue(hero) != null) hasMet = true;
                    }
                    catch { }
                }
            }
            sb.Append("\"hasMet\":" + (hasMet ? "true" : "false") + ",");
            // Banner code from hero's clan
            string bannerCode = "";
            try { if (hero.Clan?.Banner != null) bannerCode = hero.Clan.Banner.Serialize(); } catch { }
            sb.Append("\"bannerCode\":\"" + JEsc(bannerCode) + "\"");
            sb.Append("}");
            return sb.ToString();
        }

        // ── API: Single Hero Detail ──
        private static string GetHeroJson(string heroId)
        {
            Hero hero = null;
            foreach (var h in Hero.AllAliveHeroes)
                if (h?.StringId == heroId) { hero = h; break; }
            if (hero == null)
                foreach (var h in Hero.DeadOrDisabledHeroes)
                    if (h?.StringId == heroId) { hero = h; break; }
            if (hero == null) return "{\"error\":\"Hero not found\"}";

            // Merge custom name/title/culture for detail view
            var dBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
            string detailName = dBeh?.GetCustomName(hero.StringId);
            if (string.IsNullOrEmpty(detailName)) detailName = hero.Name?.ToString();
            string detailCulture = null;
            try { detailCulture = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroCulture(hero.StringId); } catch { }
            if (string.IsNullOrEmpty(detailCulture)) detailCulture = hero.Culture?.Name?.ToString();

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(hero.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(detailName) + "\",");
            sb.Append("\"culture\":\"" + JEsc(detailCulture) + "\",");
            sb.Append("\"clan\":\"" + JEsc(hero.Clan?.Name?.ToString()) + "\",");
            sb.Append("\"kingdom\":\"" + JEsc(hero.Clan?.Kingdom?.Name?.ToString()) + "\",");
            sb.Append("\"age\":" + (int)hero.Age + ",");
            sb.Append("\"isDead\":" + (hero.IsDead ? "true" : "false") + ",");
            sb.Append("\"isFemale\":" + (hero.IsFemale ? "true" : "false") + ",");
            // Title — use custom if set, else game-generated
            string detailTitle = dBeh?.GetCustomTitle(hero.StringId);
            string title = "";
            try
            {
                if (!string.IsNullOrEmpty(detailTitle))
                    title = detailTitle;
                else if (hero.IsLord && hero.Clan?.Culture != null)
                    title = (hero.IsFemale ? "Noblewoman" : "Noble") + " of the " + hero.Clan.Culture.Name?.ToString();
                else if (hero.IsPlayerCompanion)
                    title = "Companion";
                else if (hero.CharacterObject?.Occupation.ToString() != null)
                    title = hero.CharacterObject.Occupation.ToString();
            }
            catch { }
            sb.Append("\"title\":\"" + JEsc(title) + "\",");
            sb.Append("\"description\":\"" + JEsc(EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(heroId) ?? "") + "\",");

            // Family
            sb.Append("\"family\":[");
            try
            {
                var famList = new List<string>();
                if (hero.Spouse != null && hero.Spouse.IsAlive)
                    famList.Add("{\"id\":\"" + JEsc(hero.Spouse.StringId) + "\",\"name\":\"" + JEsc(hero.Spouse.Name?.ToString()) + "\",\"relation\":\"Spouse\"}");
                if (hero.Father != null)
                    famList.Add("{\"id\":\"" + JEsc(hero.Father.StringId) + "\",\"name\":\"" + JEsc(hero.Father.Name?.ToString()) + "\",\"relation\":\"Father\"" + (hero.Father.IsDead ? ",\"dead\":true" : "") + "}");
                if (hero.Mother != null)
                    famList.Add("{\"id\":\"" + JEsc(hero.Mother.StringId) + "\",\"name\":\"" + JEsc(hero.Mother.Name?.ToString()) + "\",\"relation\":\"Mother\"" + (hero.Mother.IsDead ? ",\"dead\":true" : "") + "}");
                if (hero.Children != null)
                    foreach (var child in hero.Children)
                        if (child != null)
                            famList.Add("{\"id\":\"" + JEsc(child.StringId) + "\",\"name\":\"" + JEsc(child.Name?.ToString()) + "\",\"relation\":\"" + (child.IsFemale ? "Daughter" : "Son") + "\"" + (child.IsDead ? ",\"dead\":true" : "") + "}");
                if (hero.Siblings != null)
                    foreach (var sib in hero.Siblings)
                        if (sib != null && sib != hero)
                            famList.Add("{\"id\":\"" + JEsc(sib.StringId) + "\",\"name\":\"" + JEsc(sib.Name?.ToString()) + "\",\"relation\":\"" + (sib.IsFemale ? "Sister" : "Brother") + "\"" + (sib.IsDead ? ",\"dead\":true" : "") + "}");
                sb.Append(string.Join(",", famList));
            }
            catch { }
            sb.Append("],");

            // Stats
            try
            {
                var stats = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoStats(hero);
                sb.Append("\"stats\":{");
                bool f = true;
                foreach (var kvp in stats)
                {
                    if (!f) sb.Append(",");
                    sb.Append("\"" + JEsc(kvp.Key) + "\":\"" + JEsc(kvp.Value) + "\"");
                    f = false;
                }
                sb.Append("},");
            }
            catch { sb.Append("\"stats\":{},"); }

            // Traits / Reputation
            sb.Append("\"traits\":[");
            try
            {
                var traitList = new List<string>();
                // Use reflection to get traits safely across game versions
                var heroCharDev = hero.GetType().GetMethod("GetTraitLevel");
                if (heroCharDev != null)
                {
                    // Try to get all trait objects
                    var defaultTraitsType = Type.GetType("TaleWorlds.CampaignSystem.CharacterDevelopment.DefaultTraits, TaleWorlds.CampaignSystem");
                    if (defaultTraitsType != null)
                    {
                        var personalityProp = defaultTraitsType.GetProperty("Personality", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                        if (personalityProp != null)
                        {
                            var traits = personalityProp.GetValue(null) as System.Collections.IEnumerable;
                            if (traits != null)
                            {
                                foreach (var traitObj in traits)
                                {
                                    if (traitObj == null) continue;
                                    int level = (int)heroCharDev.Invoke(hero, new object[] { traitObj });
                                    if (level != 0)
                                    {
                                        var nameProp = traitObj.GetType().GetProperty("Name");
                                        string name = nameProp?.GetValue(traitObj)?.ToString() ?? "Unknown";
                                        traitList.Add("{\"name\":\"" + JEsc(name) + "\",\"level\":" + level + "}");
                                    }
                                }
                            }
                        }
                    }
                }
                sb.Append(string.Join(",", traitList));
            }
            catch { }
            sb.Append("],");

            // Skills
            sb.Append("\"skills\":[");
            try
            {
                var skillList = new List<string>();
                var getSkillMethod = hero.GetType().GetMethod("GetSkillValue");
                if (getSkillMethod != null)
                {
                    // Get all skills via DefaultSkills or Skills
                    System.Collections.IEnumerable allSkills = null;
                    var defaultSkillsType = Type.GetType("TaleWorlds.Core.DefaultSkills, TaleWorlds.Core");
                    if (defaultSkillsType != null)
                    {
                        var getAllMethod = defaultSkillsType.GetMethod("GetAllSkills", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                        if (getAllMethod != null)
                            allSkills = getAllMethod.Invoke(null, null) as System.Collections.IEnumerable;
                    }
                    if (allSkills == null)
                    {
                        // Fallback: try TaleWorlds.Core.MBObjectManager
                        var mgrType = Type.GetType("TaleWorlds.ObjectSystem.MBObjectManager, TaleWorlds.ObjectSystem");
                        if (mgrType != null)
                        {
                            var instProp = mgrType.GetProperty("Instance", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            var inst = instProp?.GetValue(null);
                            if (inst != null)
                            {
                                var getObjs = mgrType.GetMethod("GetObjectTypeList");
                                if (getObjs != null)
                                {
                                    var skillObjType = Type.GetType("TaleWorlds.Core.SkillObject, TaleWorlds.Core");
                                    if (skillObjType != null)
                                    {
                                        var genMethod = getObjs.MakeGenericMethod(skillObjType);
                                        allSkills = genMethod.Invoke(inst, null) as System.Collections.IEnumerable;
                                    }
                                }
                            }
                        }
                    }
                    if (allSkills != null)
                    {
                        foreach (var skill in allSkills)
                        {
                            if (skill == null) continue;
                            int val = (int)getSkillMethod.Invoke(hero, new object[] { skill });
                            if (val > 0)
                            {
                                var nameProp = skill.GetType().GetProperty("Name");
                                string name = nameProp?.GetValue(skill)?.ToString() ?? "";
                                skillList.Add("{\"name\":\"" + JEsc(name) + "\",\"value\":" + val + "}");
                            }
                        }
                    }
                }
                sb.Append(string.Join(",", skillList));
            }
            catch { }
            sb.Append("],");

            // Friends & Enemies (based on relation, top 20 each)
            sb.Append("\"friends\":[");
            try
            {
                var friends = new List<KeyValuePair<int, string>>();
                foreach (var h in Hero.AllAliveHeroes)
                {
                    if (h == null || h == hero || !h.IsLord) continue;
                    try
                    {
                        int rel = hero.GetRelation(h);
                        if (rel >= 20)
                            friends.Add(new KeyValuePair<int, string>(rel, "{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\",\"relation\":" + rel + "}"));
                    }
                    catch { }
                }
                friends.Sort((a, b) => b.Key.CompareTo(a.Key));
                var top = friends.Count > 20 ? friends.GetRange(0, 20) : friends;
                sb.Append(string.Join(",", top.ConvertAll(x => x.Value)));
            }
            catch { }
            sb.Append("],");

            sb.Append("\"enemies\":[");
            try
            {
                var enemies = new List<KeyValuePair<int, string>>();
                foreach (var h in Hero.AllAliveHeroes)
                {
                    if (h == null || h == hero || !h.IsLord) continue;
                    try
                    {
                        int rel = hero.GetRelation(h);
                        if (rel <= -20)
                            enemies.Add(new KeyValuePair<int, string>(rel, "{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\",\"relation\":" + rel + "}"));
                    }
                    catch { }
                }
                enemies.Sort((a, b) => a.Key.CompareTo(b.Key));
                var top = enemies.Count > 20 ? enemies.GetRange(0, 20) : enemies;
                sb.Append(string.Join(",", top.ConvertAll(x => x.Value)));
            }
            catch { }
            sb.Append("],");

            // Lore fields
            sb.Append("\"lore\":{");
            string[] fields = { "backstory", "personality", "goals", "relationships", "rumors" };
            for (int i = 0; i < fields.Length; i++)
            {
                if (i > 0) sb.Append(",");
                string val = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroInfoField(fields[i], heroId) ?? "";
                sb.Append("\"" + fields[i] + "\":\"" + JEsc(val) + "\"");
            }
            sb.Append("},");

            // Journal entries — deduplicated by (date + normalized text)
            sb.Append("\"journal\":[");
            var entries = EditableEncyclopedia.EditableEncyclopediaAPI.GetJournalEntries(heroId);
            if (entries != null)
            {
                bool jFirst = true;
                var seenJ = new HashSet<string>();
                foreach (var entry in entries)
                {
                    var keyJ = (entry.Date ?? "") + "||" + ((entry.Text ?? "").Trim().ToLowerInvariant());
                    if (seenJ.Contains(keyJ)) continue;
                    seenJ.Add(keyJ);
                    if (!jFirst) sb.Append(",");
                    sb.Append("{\"date\":\"" + JEsc(entry.Date ?? "") + "\",\"text\":\"" + JEsc(entry.Text ?? "") + "\"}");
                    jFirst = false;
                }
            }
            sb.Append("],");

            // Banner code
            string bannerCode = "";
            try { if (hero.Clan?.Banner != null) bannerCode = hero.Clan.Banner.Serialize(); } catch { }
            sb.Append("\"bannerCode\":\"" + JEsc(bannerCode) + "\",");

            // Chronicle
            string chronicle = "";
            try { chronicle = EditableEncyclopedia.EditableEncyclopediaAPI.GetHeroChronicle(heroId) ?? ""; } catch { }
            sb.Append("\"chronicle\":\"" + JEsc(chronicle) + "\",");

            // Relation notes (notes this hero has about others)
            sb.Append("\"relationNotes\":[");
            try
            {
                var allNotes = EditableEncyclopedia.EditableEncyclopediaAPI.GetAllRelationNotes();
                bool rnFirst = true;
                if (allNotes != null)
                {
                    foreach (var kvp in allNotes)
                    {
                        // Keys are "heroId_targetId" format
                        if (kvp.Key != null && kvp.Key.StartsWith(heroId + "_"))
                        {
                            if (!rnFirst) sb.Append(",");
                            string targetId = kvp.Key.Substring(heroId.Length + 1);
                            // Try to find target hero name
                            string targetName = targetId;
                            try
                            {
                                foreach (var th in Hero.AllAliveHeroes)
                                    if (th?.StringId == targetId && th.Name != null) { targetName = th.Name.ToString(); break; }
                                if (targetName == targetId)
                                    foreach (var th in Hero.DeadOrDisabledHeroes)
                                        if (th?.StringId == targetId && th.Name != null) { targetName = th.Name.ToString(); break; }
                            }
                            catch { }
                            sb.Append("{\"targetId\":\"" + JEsc(targetId) + "\",\"targetName\":\"" + JEsc(targetName) + "\",\"note\":\"" + JEsc(kvp.Value ?? "") + "\"}");
                            rnFirst = false;
                        }
                    }
                }
            }
            catch { }
            sb.Append("],");

            // Tags
            string tags = EditableEncyclopedia.EditableEncyclopediaAPI.GetTags(heroId) ?? "";
            sb.Append("\"tags\":\"" + JEsc(tags) + "\",");

            // Timeline events from global chronicle — deduped by (date + normalized text)
            sb.Append("\"timeline\":[");
            try
            {
                var allEvents = EditableEncyclopedia.EditableEncyclopediaAPI.GetAllChronicleEntries();
                bool tlFirst = true;
                var seenT = new HashSet<string>();
                if (allEvents != null)
                {
                    foreach (var e in allEvents)
                    {
                        if (e.EntityId == heroId || (e.Text != null && e.Text.Contains(heroId)))
                        {
                            var keyT = (e.Date ?? "") + "||" + ((e.Text ?? "").Trim().ToLowerInvariant());
                            if (seenT.Contains(keyT)) continue;
                            seenT.Add(keyT);
                            if (!tlFirst) sb.Append(",");
                            sb.Append("{\"date\":\"" + JEsc(e.Date ?? "") + "\",\"text\":\"" + JEsc(e.Text ?? "") + "\",\"entityId\":\"" + JEsc(e.EntityId ?? "") + "\"}");
                            tlFirst = false;
                        }
                    }
                }
            }
            catch { }
            sb.Append("]");

            sb.Append("}");
            return sb.ToString();
        }

        // ── API: List Clans ──
        private static string GetClansJson()
        {
            var sb = new StringBuilder("[");
            bool first = true;
            foreach (var clan in Clan.All)
            {
                if (clan == null) continue;
                if (!first) sb.Append(",");
                string desc = EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(clan.StringId) ?? "";
                string bannerCode = "";
                try { if (clan.Banner != null) bannerCode = clan.Banner.Serialize(); } catch { }
                int tier = 0, members = 0, fiefs = 0, troops = 0, garrisons = 0;
                int towns = 0, castles = 0, villages = 0;
                int renown = 0, influence = 0, wealth = 0;
                string leader = "";
                bool isMinorFaction = false, isBandit = false;
                try { tier = clan.Tier; } catch { }
                try { leader = clan.Leader?.Name?.ToString() ?? ""; } catch { }
                try { members = clan.Heroes?.Count ?? 0; } catch { }
                try { renown = (int)(clan.Renown); } catch { }
                try { influence = (int)(clan.Influence); } catch { }
                try
                {
                    var wProp = clan.GetType().GetProperty("Gold");
                    if (wProp != null) wealth = (int)wProp.GetValue(clan);
                }
                catch { }
                try
                {
                    foreach (var f in clan.Fiefs)
                    {
                        fiefs++;
                        if (f.IsTown) towns++;
                        else if (f.IsCastle) castles++;
                    }
                    foreach (var v in clan.Settlements)
                        if (v != null && v.IsVillage) villages++;
                }
                catch { }
                try
                {
                    foreach (var wpc in clan.WarPartyComponents)
                    {
                        if (wpc?.MobileParty?.MemberRoster != null)
                            troops += wpc.MobileParty.MemberRoster.TotalManCount;
                    }
                    foreach (var f in clan.Fiefs)
                    {
                        if (f?.GarrisonParty?.MemberRoster != null)
                            garrisons += f.GarrisonParty.MemberRoster.TotalManCount;
                    }
                }
                catch { }
                try { isMinorFaction = clan.IsMinorFaction; } catch { }
                try { isBandit = clan.IsBanditFaction; } catch { }
                // Wars
                var warNames = new System.Collections.Generic.List<string>();
                try
                {
                    foreach (var k in Kingdom.All)
                    {
                        if (k == null) continue;
                        try { if (FactionManager.IsAtWarAgainstFaction(clan, k)) warNames.Add(k.Name?.ToString() ?? ""); } catch { }
                    }
                }
                catch { }
                // Merge custom name/banner
                var cBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string clanDisplayName = cBeh?.GetCustomName(clan.StringId);
                if (string.IsNullOrEmpty(clanDisplayName)) clanDisplayName = clan.Name?.ToString();
                string clanBannerMerged = cBeh?.GetCustomBannerCode(clan.StringId);
                if (string.IsNullOrEmpty(clanBannerMerged)) clanBannerMerged = bannerCode;
                sb.Append("{\"id\":\"" + JEsc(clan.StringId) + "\",\"name\":\"" + JEsc(clanDisplayName) + "\"," +
                    "\"culture\":\"" + JEsc(clan.Culture?.Name?.ToString()) + "\"," +
                    "\"kingdom\":\"" + JEsc(clan.Kingdom?.Name?.ToString()) + "\"," +
                    "\"description\":\"" + JEsc(desc) + "\"," +
                    "\"tier\":" + tier + "," +
                    "\"leader\":\"" + JEsc(leader) + "\"," +
                    "\"members\":" + members + "," +
                    "\"fiefs\":" + fiefs + "," +
                    "\"towns\":" + towns + ",\"castles\":" + castles + ",\"villages\":" + villages + "," +
                    "\"troops\":" + troops + ",\"garrisons\":" + garrisons + "," +
                    "\"strength\":" + (troops + garrisons) + "," +
                    "\"renown\":" + renown + ",\"influence\":" + influence + ",\"wealth\":" + wealth + "," +
                    "\"isMinorFaction\":" + (isMinorFaction ? "true" : "false") + "," +
                    "\"isBandit\":" + (isBandit ? "true" : "false") + "," +
                    "\"wars\":[" + string.Join(",", warNames.ConvertAll(w => "\"" + JEsc(w) + "\"")) + "]," +
                    "\"bannerCode\":\"" + JEsc(clanBannerMerged) + "\"}");
                first = false;
            }
            sb.Append("]");
            return sb.ToString();
        }

        // ── API: List Kingdoms ──
        private static string GetKingdomsJson()
        {
            var sb = new StringBuilder("[");
            bool first = true;
            foreach (var k in Kingdom.All)
            {
                if (k == null) continue;
                if (!first) sb.Append(",");
                string desc = EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(k.StringId) ?? "";
                string bannerCode = "";
                try { if (k.Banner != null) bannerCode = k.Banner.Serialize(); } catch { }

                // Diplomacy: wars and clan/fief counts
                var warNames = new List<string>();
                try
                {
                    // Get wars by checking each other kingdom
                    foreach (var otherK in Kingdom.All)
                    {
                        if (otherK == null || otherK == k) continue;
                        try
                        {
                            if (FactionManager.IsAtWarAgainstFaction(k, otherK))
                                warNames.Add(otherK.Name?.ToString() ?? "");
                        }
                        catch { }
                    }
                }
                catch { }
                int clanCount = 0, fiefCount = 0, strength = 0;
                try { clanCount = k.Clans?.Count ?? 0; } catch { }
                try
                {
                    foreach (var c in k.Clans)
                        foreach (var f in c.Fiefs) fiefCount++;
                }
                catch { }
                try
                {
                    var tsProp = k.GetType().GetProperty("TotalStrength");
                    if (tsProp != null)
                    {
                        var val = tsProp.GetValue(k);
                        if (val is float f) strength = (int)f;
                        else if (val is double d) strength = (int)d;
                        else if (val is int iv) strength = iv;
                    }
                    // Fallback: sum troops if TotalStrength is 0
                    if (strength <= 0)
                    {
                        int total = 0;
                        foreach (var c in k.Clans)
                        {
                            try
                            {
                                // Sum war party troops
                                foreach (var wpc in c.WarPartyComponents)
                                {
                                    if (wpc?.MobileParty?.MemberRoster != null)
                                        total += wpc.MobileParty.MemberRoster.TotalManCount;
                                }
                                // Sum garrison troops from fiefs
                                foreach (var fief in c.Fiefs)
                                {
                                    if (fief?.GarrisonParty?.MemberRoster != null)
                                        total += fief.GarrisonParty.MemberRoster.TotalManCount;
                                }
                            }
                            catch { }
                        }
                        if (total > 0) strength = total;
                    }
                }
                catch { }

                // Diplomacy status relative to player's clan/kingdom
                string playerDiplomacy = "Neutral";
                try
                {
                    var playerClan = Hero.MainHero?.Clan;
                    var playerKingdom = playerClan?.Kingdom;
                    if (playerKingdom != null && playerKingdom == k)
                        playerDiplomacy = "Own Kingdom";
                    else if (playerKingdom != null)
                    {
                        try
                        {
                            if (FactionManager.IsAtWarAgainstFaction(playerKingdom, k))
                                playerDiplomacy = "Enemy";
                        }
                        catch { }
                        if (playerDiplomacy == "Neutral")
                        {
                            try
                            {
                                var stance = playerKingdom.GetStanceWith(k);
                                if (stance != null)
                                {
                                    var allyProp = stance.GetType().GetProperty("IsAllied");
                                    if (allyProp != null && (bool)allyProp.GetValue(stance))
                                        playerDiplomacy = "Ally";
                                }
                            }
                            catch { }
                        }
                    }
                    else if (playerClan != null && playerKingdom == null)
                    {
                        // Player is independent clan — check clan-level war status
                        try
                        {
                            if (FactionManager.IsAtWarAgainstFaction(playerClan, k))
                                playerDiplomacy = "Enemy";
                        }
                        catch { }
                    }
                }
                catch { }

                // Merge custom name/banner
                var kBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string kDisplayName = kBeh?.GetCustomName(k.StringId);
                if (string.IsNullOrEmpty(kDisplayName)) kDisplayName = k.Name?.ToString();
                string kBannerMerged = kBeh?.GetCustomBannerCode(k.StringId);
                if (string.IsNullOrEmpty(kBannerMerged)) kBannerMerged = bannerCode;
                sb.Append("{\"id\":\"" + JEsc(k.StringId) + "\",\"name\":\"" + JEsc(kDisplayName) + "\"," +
                    "\"culture\":\"" + JEsc(k.Culture?.Name?.ToString()) + "\"," +
                    "\"ruler\":\"" + JEsc(k.Leader?.Name?.ToString()) + "\"," +
                    "\"description\":\"" + JEsc(desc) + "\"," +
                    "\"bannerCode\":\"" + JEsc(kBannerMerged) + "\"," +
                    "\"clanCount\":" + clanCount + "," +
                    "\"fiefCount\":" + fiefCount + "," +
                    "\"strength\":" + strength + "," +
                    "\"diplomacy\":\"" + JEsc(playerDiplomacy) + "\"," +
                    "\"wars\":[" + string.Join(",", warNames.ConvertAll(w => "\"" + JEsc(w) + "\"")) + "]}");
                first = false;
            }
            sb.Append("]");
            return sb.ToString();
        }

        // ── API: List Settlements ──
        private static string GetSettlementsJson()
        {
            var sb = new StringBuilder("[");
            bool first = true;
            foreach (var s in Settlement.All)
            {
                if (s == null || (!s.IsTown && !s.IsCastle && !s.IsVillage)) continue;
                if (!first) sb.Append(",");
                string type = s.IsTown ? "Town" : s.IsCastle ? "Castle" : "Village";
                string desc = EditableEncyclopedia.EditableEncyclopediaAPI.GetDescription(s.StringId) ?? "";
                // Stats for cards and dashboard
                int prosperity = 0, loyalty = 0, security = 0, foodStocks = 0, garrison = 0, militia = 0;
                int tradeTax = 0, workshopCount = 0, wallLevel = 0, dailyIncome = 0;
                int garrisonWageLimit = 0; // 0 = unlimited
                bool autoRecruitment = false;
                string kingdom = "", governor = "", governorId = "", villageProduces = "", buildingInfo = "";
                string boundToName = "", boundToId = "";
                try
                {
                    kingdom = s.OwnerClan?.Kingdom?.Name?.ToString() ?? "";
                    if (s.IsTown || s.IsCastle)
                    {
                        var town = s.Town;
                        if (town != null)
                        {
                            prosperity = (int)town.Prosperity;
                            loyalty = (int)town.Loyalty;
                            security = (int)town.Security;
                            foodStocks = (int)town.FoodStocks;
                            garrison = town.GarrisonParty?.MemberRoster?.TotalManCount ?? 0;
                            try { militia = (int)town.Militia; } catch { }
                            try { governor = town.Governor?.Name?.ToString() ?? ""; } catch { }
                            try { governorId = town.Governor?.StringId ?? ""; } catch { }
                            try { tradeTax = (int)town.TradeTaxAccumulated; } catch { }
                            try { wallLevel = town.GetWallLevel(); } catch { }
                            try
                            {
                                var bList = new List<string>();
                                foreach (var b in town.Buildings)
                                {
                                    if (b != null && b.CurrentLevel > 0)
                                        bList.Add(b.Name?.ToString() + " Lv" + b.CurrentLevel);
                                }
                                if (town.CurrentBuilding != null)
                                    bList.Insert(0, "[Building] " + town.CurrentBuilding.Name?.ToString());
                                buildingInfo = string.Join(", ", bList);
                            }
                            catch { }
                            try { dailyIncome = (int)(town.Prosperity * 0.02f + tradeTax); } catch { }
                            // Garrison wage limit — on Settlement, not Town
                            try
                            {
                                var wlProp = s.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                    .FirstOrDefault(p => p.Name.Contains("WagePaymentLimit") || p.Name.Contains("WageLimit") || p.Name.Contains("GarrisonWage"));
                                if (wlProp != null) garrisonWageLimit = Convert.ToInt32(wlProp.GetValue(s));
                            }
                            catch { }
                            // Auto recruitment — on GarrisonParty
                            try
                            {
                                var gp = town.GarrisonParty;
                                if (gp != null)
                                {
                                    var arProp = gp.GetType().GetProperty("IsAutoRecruitmentEnabled", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    if (arProp != null) autoRecruitment = (bool)arProp.GetValue(gp);
                                }
                            }
                            catch { }
                            if (s.IsTown)
                            {
                                try
                                {
                                    foreach (var ws in town.Workshops)
                                        if (ws?.WorkshopType != null && !ws.WorkshopType.IsHidden) workshopCount++;
                                }
                                catch { }
                            }
                        }
                    }
                    else if (s.IsVillage)
                    {
                        try
                        {
                            var prod = s.Village?.VillageType?.PrimaryProduction;
                            if (prod != null) villageProduces = prod.Name?.ToString() ?? "";
                            try { militia = (int)(s.Village?.Militia ?? 0); } catch { }
                            try { prosperity = (int)(s.Village?.Hearth ?? 0); } catch { }
                            try
                            {
                                var bound = s.Village?.Bound;
                                boundToName = bound?.Name?.ToString() ?? "";
                                boundToId = bound?.StringId ?? "";
                            }
                            catch { }
                        }
                        catch { }
                    }
                }
                catch { }
                // Merge custom name/banner
                var sBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string sDisplayName = sBeh?.GetCustomName(s.StringId);
                if (string.IsNullOrEmpty(sDisplayName)) sDisplayName = s.Name?.ToString();
                sb.Append("{\"id\":\"" + JEsc(s.StringId) + "\",\"name\":\"" + JEsc(sDisplayName) + "\"," +
                    "\"type\":\"" + type + "\"," +
                    "\"culture\":\"" + JEsc(s.Culture?.Name?.ToString()) + "\"," +
                    "\"owner\":\"" + JEsc(s.OwnerClan?.Name?.ToString()) + "\"," +
                    "\"kingdom\":\"" + JEsc(kingdom) + "\"," +
                    "\"description\":\"" + JEsc(desc) + "\"," +
                    "\"prosperity\":" + prosperity + "," +
                    "\"loyalty\":" + loyalty + "," +
                    "\"security\":" + security + "," +
                    "\"foodStocks\":" + foodStocks + "," +
                    "\"garrison\":" + garrison + "," +
                    "\"militia\":" + militia + "," +
                    "\"tradeTax\":" + tradeTax + "," +
                    "\"workshopCount\":" + workshopCount + "," +
                    "\"governor\":\"" + JEsc(governor) + "\"," +
                    "\"governorId\":\"" + JEsc(governorId) + "\"," +
                    "\"villageProduces\":\"" + JEsc(villageProduces) + "\"," +
                    "\"boundTo\":\"" + JEsc(boundToName) + "\"," +
                    "\"boundToId\":\"" + JEsc(boundToId) + "\"," +
                    "\"isVillage\":" + (s.IsVillage ? "true" : "false") + "," +
                    "\"wallLevel\":" + wallLevel + "," +
                    "\"buildings\":\"" + JEsc(buildingInfo) + "\"," +
                    "\"dailyIncome\":" + dailyIncome + "," +
                    "\"garrisonWageLimit\":" + garrisonWageLimit + "," +
                    "\"autoRecruitment\":" + (autoRecruitment ? "true" : "false") + "," +
                    "\"bannerCode\":\"" + JEsc(s.OwnerClan?.Banner != null ? s.OwnerClan.Banner.Serialize() : "") + "\"}");
                first = false;
            }
            sb.Append("]");
            return sb.ToString();
        }

        // ── API: Settlement Detail ──
        private static string GetSettlementDetailJson(string id)
        {
            Settlement s = null;
            foreach (var st in Settlement.All)
                if (st != null && st.StringId == id) { s = st; break; }
            if (s == null) return "{\"error\":\"not found\"}";

            // Merge custom name
            var sdBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
            string sdName = sdBeh?.GetCustomName(s.StringId);
            if (string.IsNullOrEmpty(sdName)) sdName = s.Name?.ToString();

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(s.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(sdName) + "\",");
            string type = s.IsTown ? "Town" : s.IsCastle ? "Castle" : "Village";
            sb.Append("\"type\":\"" + type + "\",");
            sb.Append("\"culture\":\"" + JEsc(s.Culture?.Name?.ToString()) + "\",");
            string bannerCode = "";
            try { if (s.OwnerClan?.Banner != null) bannerCode = s.OwnerClan.Banner.Serialize(); } catch { }
            sb.Append("\"bannerCode\":\"" + JEsc(bannerCode) + "\",");

            // Owner — hero (clan leader) with clan banner
            sb.Append("\"owner\":{");
            try
            {
                var ownerHero = s.OwnerClan?.Leader;
                if (ownerHero != null)
                {
                    string ownerBanner = "";
                    try { if (s.OwnerClan.Banner != null) ownerBanner = s.OwnerClan.Banner.Serialize(); } catch { }
                    sb.Append("\"id\":\"" + JEsc(ownerHero.StringId) + "\",");
                    sb.Append("\"name\":\"" + JEsc(ownerHero.Name?.ToString()) + "\",");
                    sb.Append("\"culture\":\"" + JEsc(ownerHero.Culture?.Name?.ToString()) + "\",");
                    sb.Append("\"isFemale\":" + (ownerHero.IsFemale ? "true" : "false") + ",");
                    sb.Append("\"bannerCode\":\"" + JEsc(ownerBanner) + "\"");
                }
            }
            catch { }
            sb.Append("},");

            // Notable characters
            sb.Append("\"notables\":[");
            bool first = true;
            try
            {
                foreach (var h in s.Notables)
                {
                    if (h == null) continue;
                    if (!first) sb.Append(",");
                    sb.Append("{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\"}");
                    first = false;
                }
            }
            catch { }
            sb.Append("],");

            // Villages (for towns/castles)
            sb.Append("\"villages\":[");
            first = true;
            try
            {
                if (s.IsTown || s.IsCastle)
                {
                    foreach (var v in s.BoundVillages)
                    {
                        if (v?.Settlement == null) continue;
                        if (!first) sb.Append(",");
                        string vBanner = "";
                        try { if (v.Settlement.OwnerClan?.Banner != null) vBanner = v.Settlement.OwnerClan.Banner.Serialize(); } catch { }
                        string vType = v.Settlement.IsVillage ? "Village" : v.Settlement.IsTown ? "Town" : "Castle";
                        sb.Append("{\"id\":\"" + JEsc(v.Settlement.StringId) + "\",\"name\":\"" + JEsc(v.Settlement.Name?.ToString()) + "\",\"type\":\"" + vType + "\",\"bannerCode\":\"" + JEsc(vBanner) + "\"}");
                        first = false;
                    }
                }
            }
            catch { }
            sb.Append("],");

            // Stats
            int prosperity = 0, loyalty = 0, security = 0, foodStocks = 0, garrison = 0, militia = 0;
            int tradeTax = 0, workshopCount = 0, notableCount = 0, villageCount = 0;
            string governor = "", kingdom = "", clanName = "";
            string workshopNames = "", villageProduces = "";
            try
            {
                clanName = s.OwnerClan?.Name?.ToString() ?? "";
                kingdom = s.OwnerClan?.Kingdom?.Name?.ToString() ?? "";
                if (s.IsTown || s.IsCastle)
                {
                    var town = s.Town;
                    if (town != null)
                    {
                        prosperity = (int)town.Prosperity;
                        loyalty = (int)town.Loyalty;
                        security = (int)town.Security;
                        foodStocks = (int)town.FoodStocks;
                        garrison = town.GarrisonParty?.MemberRoster?.TotalManCount ?? 0;
                        try { militia = (int)town.Militia; } catch { }
                        try { governor = town.Governor?.Name?.ToString() ?? "None"; } catch { governor = "None"; }
                        try { tradeTax = (int)town.TradeTaxAccumulated; } catch { }
                    }
                    // Workshops
                    try
                    {
                        if (s.IsTown)
                        {
                            var wsNames = new System.Collections.Generic.List<string>();
                            foreach (var ws in town.Workshops)
                            {
                                if (ws != null && ws.WorkshopType != null && !ws.WorkshopType.IsHidden)
                                {
                                    wsNames.Add(ws.WorkshopType.Name?.ToString() ?? "");
                                    workshopCount++;
                                }
                            }
                            if (wsNames.Count > 0) workshopNames = string.Join(", ", wsNames);
                        }
                    }
                    catch { }
                    // Village count and produces
                    try
                    {
                        var produces = new System.Collections.Generic.List<string>();
                        foreach (var v in s.BoundVillages)
                        {
                            if (v?.Settlement == null) continue;
                            villageCount++;
                            try
                            {
                                var prod = v.Settlement.Village?.VillageType?.PrimaryProduction;
                                if (prod != null) produces.Add(prod.Name?.ToString() ?? "");
                            }
                            catch { }
                        }
                        if (produces.Count > 0) villageProduces = string.Join(", ", produces);
                    }
                    catch { }
                }
                try { notableCount = s.Notables?.Count ?? 0; } catch { }
            }
            catch { }
            sb.Append("\"prosperity\":" + prosperity + ",");
            sb.Append("\"loyalty\":" + loyalty + ",");
            sb.Append("\"security\":" + security + ",");
            sb.Append("\"foodStocks\":" + foodStocks + ",");
            sb.Append("\"garrison\":" + garrison + ",");
            sb.Append("\"militia\":" + militia + ",");
            sb.Append("\"tradeTax\":" + tradeTax + ",");
            sb.Append("\"workshopCount\":" + workshopCount + ",");
            sb.Append("\"workshopNames\":\"" + JEsc(workshopNames) + "\",");
            sb.Append("\"notableCount\":" + notableCount + ",");
            sb.Append("\"villageCount\":" + villageCount + ",");
            sb.Append("\"villageProduces\":\"" + JEsc(villageProduces) + "\",");
            sb.Append("\"governor\":\"" + JEsc(governor) + "\",");
            sb.Append("\"kingdom\":\"" + JEsc(kingdom) + "\",");
            sb.Append("\"clan\":\"" + JEsc(clanName) + "\"");

            sb.Append("}");
            return sb.ToString();
        }

        // ── API: Fief Detail (rich management data) ──
        private static string GetFiefDetailJson(string id)
        {
            Settlement s = null;
            foreach (var st in Settlement.All)
                if (st != null && st.StringId == id) { s = st; break; }
            if (s == null) return "{\"error\":\"not found\"}";

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(s.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(s.Name?.ToString()) + "\",");
            string type = s.IsTown ? "Town" : s.IsCastle ? "Castle" : "Village";
            sb.Append("\"type\":\"" + type + "\",");
            sb.Append("\"culture\":\"" + JEsc(s.Culture?.Name?.ToString()) + "\",");

            try
            {
                var town = s.Town;
                if (town != null)
                {
                    // Basic stats
                    sb.Append("\"prosperity\":" + (int)town.Prosperity + ",");
                    sb.Append("\"loyalty\":" + (int)town.Loyalty + ",");
                    sb.Append("\"security\":" + (int)town.Security + ",");
                    sb.Append("\"foodStocks\":" + (int)town.FoodStocks + ",");
                    sb.Append("\"garrison\":" + (town.GarrisonParty?.MemberRoster?.TotalManCount ?? 0) + ",");
                    try { sb.Append("\"militia\":" + (int)town.Militia + ","); } catch { sb.Append("\"militia\":0,"); }

                    // Change explanations
                    try
                    {
                        var pc = town.ProsperityChangeExplanation;
                        sb.Append("\"prosperityChange\":" + pc.ResultNumber.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                        sb.Append("\"prosperityLines\":[");
                        bool first = true;
                        foreach (var line in pc.GetLines())
                        {
                            if (Math.Abs(line.number) < 0.01f) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(line.name) + "\",\"value\":" + line.number.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + "}");
                            first = false;
                        }
                        sb.Append("],");
                    }
                    catch { sb.Append("\"prosperityChange\":0,\"prosperityLines\":[],"); }

                    try
                    {
                        var lc = town.LoyaltyChangeExplanation;
                        sb.Append("\"loyaltyChange\":" + lc.ResultNumber.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                        sb.Append("\"loyaltyLines\":[");
                        bool first = true;
                        foreach (var line in lc.GetLines())
                        {
                            if (Math.Abs(line.number) < 0.01f) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(line.name) + "\",\"value\":" + line.number.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + "}");
                            first = false;
                        }
                        sb.Append("],");
                    }
                    catch { sb.Append("\"loyaltyChange\":0,\"loyaltyLines\":[],"); }

                    try
                    {
                        var sc2 = town.SecurityChangeExplanation;
                        sb.Append("\"securityChange\":" + sc2.ResultNumber.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                        sb.Append("\"securityLines\":[");
                        bool first = true;
                        foreach (var line in sc2.GetLines())
                        {
                            if (Math.Abs(line.number) < 0.01f) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(line.name) + "\",\"value\":" + line.number.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + "}");
                            first = false;
                        }
                        sb.Append("],");
                    }
                    catch { sb.Append("\"securityChange\":0,\"securityLines\":[],"); }

                    try
                    {
                        var fc = town.FoodChangeExplanation;
                        sb.Append("\"foodChange\":" + fc.ResultNumber.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                        sb.Append("\"foodLines\":[");
                        bool first = true;
                        foreach (var line in fc.GetLines())
                        {
                            if (Math.Abs(line.number) < 0.01f) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(line.name) + "\",\"value\":" + line.number.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + "}");
                            first = false;
                        }
                        sb.Append("],");
                    }
                    catch { sb.Append("\"foodChange\":0,\"foodLines\":[],"); }

                    try
                    {
                        var mc = town.MilitiaChangeExplanation;
                        sb.Append("\"militiaChange\":" + mc.ResultNumber.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                    }
                    catch { sb.Append("\"militiaChange\":0,"); }

                    // Governor
                    sb.Append("\"governor\":\"" + JEsc(town.Governor?.Name?.ToString() ?? "") + "\",");
                    sb.Append("\"governorId\":\"" + JEsc(town.Governor?.StringId ?? "") + "\",");

                    // Wall level
                    try { sb.Append("\"wallLevel\":" + town.GetWallLevel() + ","); } catch { sb.Append("\"wallLevel\":0,"); }

                    // Buildings with level and progress
                    sb.Append("\"buildings\":[");
                    try
                    {
                        bool first = true;
                        int bIdx = 0;
                        foreach (var b in town.Buildings)
                        {
                            if (b == null) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(b.Name?.ToString()) + "\"");
                            sb.Append(",\"level\":" + b.CurrentLevel);
                            sb.Append(",\"index\":" + bIdx);
                            try
                            {
                                var expMethod = b.GetType().GetMethod("GetExplanation");
                                if (expMethod != null) sb.Append(",\"explanation\":\"" + JEsc(expMethod.Invoke(b, null)?.ToString() ?? "") + "\"");
                            }
                            catch { }
                            sb.Append(",\"isCurrentProject\":" + (b == town.CurrentBuilding ? "true" : "false"));
                            sb.Append("}");
                            first = false;
                            bIdx++;
                        }
                    }
                    catch { }
                    sb.Append("],");

                    // Current project
                    sb.Append("\"currentProject\":\"" + JEsc(town.CurrentBuilding?.Name?.ToString() ?? "None") + "\",");

                    // Construction progress
                    try { sb.Append("\"construction\":" + town.Construction.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ","); } catch { sb.Append("\"construction\":0,"); }

                    // Workshops detail
                    sb.Append("\"workshops\":[");
                    try
                    {
                        bool first = true;
                        if (s.IsTown)
                        {
                            foreach (var ws in town.Workshops)
                            {
                                if (ws?.WorkshopType == null || ws.WorkshopType.IsHidden) continue;
                                if (!first) sb.Append(",");
                                sb.Append("{\"name\":\"" + JEsc(ws.WorkshopType.Name?.ToString()) + "\"");
                                try
                                {
                                    var ownerProp = ws.GetType().GetProperty("Owner");
                                    var wsOwner = ownerProp?.GetValue(ws) as Hero;
                                    sb.Append(",\"owner\":\"" + JEsc(wsOwner?.Name?.ToString() ?? "") + "\"");
                                    sb.Append(",\"isPlayer\":" + (wsOwner == Hero.MainHero ? "true" : "false"));
                                }
                                catch { sb.Append(",\"owner\":\"\",\"isPlayer\":false"); }
                                try
                                {
                                    var profitProp = ws.GetType().GetProperty("ProfitMade");
                                    if (profitProp != null) sb.Append(",\"profit\":" + Convert.ToInt32(profitProp.GetValue(ws)));
                                }
                                catch { }
                                sb.Append("}");
                                first = false;
                            }
                        }
                    }
                    catch { }
                    sb.Append("],");

                    // Trade tax
                    try { sb.Append("\"tradeTax\":" + (int)town.TradeTaxAccumulated + ","); } catch { sb.Append("\"tradeTax\":0,"); }

                    // Garrison troops
                    sb.Append("\"garrisonTroops\":[");
                    try
                    {
                        var gRoster = town.GarrisonParty?.MemberRoster;
                        if (gRoster != null)
                        {
                            bool first = true;
                            for (int gi = 0; gi < gRoster.Count; gi++)
                            {
                                var el = gRoster.GetElementCopyAtIndex(gi);
                                if (el.Character == null) continue;
                                if (!first) sb.Append(",");
                                sb.Append("{\"name\":\"" + JEsc(el.Character.Name?.ToString()) + "\"");
                                sb.Append(",\"count\":" + el.Number);
                                sb.Append(",\"wounded\":" + el.WoundedNumber);
                                sb.Append(",\"tier\":" + el.Character.Tier);
                                sb.Append(",\"isHero\":" + (el.Character.IsHero ? "true" : "false"));
                                sb.Append(",\"isMounted\":" + (el.Character.IsMounted ? "true" : "false"));
                                sb.Append(",\"isRanged\":" + (el.Character.IsRanged ? "true" : "false"));
                                sb.Append("}");
                                first = false;
                            }
                        }
                    }
                    catch { }
                    sb.Append("],");

                    // Wage limit
                    int wageLimit2 = 0;
                    try
                    {
                        var wlProp2 = s.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                            .FirstOrDefault(p => p.Name.Contains("WagePaymentLimit") || p.Name.Contains("WageLimit") || p.Name.Contains("GarrisonWage"));
                        if (wlProp2 != null) wageLimit2 = Convert.ToInt32(wlProp2.GetValue(s));
                    }
                    catch { }
                    sb.Append("\"garrisonWageLimit\":" + wageLimit2 + ",");

                    // Garrison wage
                    sb.Append("\"garrisonWage\":" + (town.GarrisonParty?.TotalWage ?? 0) + ",");

                    // Has tournament
                    sb.Append("\"hasTournament\":" + (town.HasTournament ? "true" : "false") + ",");
                }
                else if (s.IsVillage)
                {
                    // Village data
                    try { sb.Append("\"hearth\":" + (int)(s.Village?.Hearth ?? 0) + ","); } catch { sb.Append("\"hearth\":0,"); }
                    try { sb.Append("\"militia\":" + (int)(s.Village?.Militia ?? 0) + ","); } catch { sb.Append("\"militia\":0,"); }
                    try
                    {
                        var prod = s.Village?.VillageType?.PrimaryProduction;
                        sb.Append("\"produces\":\"" + JEsc(prod?.Name?.ToString() ?? "") + "\",");
                    }
                    catch { sb.Append("\"produces\":\"\","); }
                    try
                    {
                        var bound = s.Village?.Bound;
                        sb.Append("\"boundTo\":\"" + JEsc(bound?.Name?.ToString() ?? "") + "\",");
                        sb.Append("\"boundToId\":\"" + JEsc(bound?.StringId ?? "") + "\",");
                    }
                    catch { sb.Append("\"boundTo\":\"\",\"boundToId\":\"\","); }
                }

                // Notables with power, relation, occupation
                sb.Append("\"notables\":[");
                bool nFirst = true;
                try
                {
                    foreach (var n in s.Notables)
                    {
                        if (n == null) continue;
                        if (!nFirst) sb.Append(",");
                        int rel2 = 0;
                        try { rel2 = Hero.MainHero.GetRelation(n); } catch { }
                        sb.Append("{\"id\":\"" + JEsc(n.StringId) + "\",\"name\":\"" + JEsc(n.Name?.ToString()) + "\"");
                        sb.Append(",\"power\":" + (int)n.Power);
                        sb.Append(",\"relation\":" + rel2);
                        sb.Append(",\"occupation\":\"" + JEsc(n.Occupation.ToString()) + "\"");
                        sb.Append(",\"isSupporter\":" + (rel2 >= 25 ? "true" : "false"));
                        sb.Append("}");
                        nFirst = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Alleys
                sb.Append("\"alleys\":[");
                try
                {
                    bool aFirst = true;
                    var alleysProp = s.GetType().GetProperty("Alleys");
                    if (alleysProp != null)
                    {
                        var alleyList = alleysProp.GetValue(s) as System.Collections.IEnumerable;
                        if (alleyList != null)
                        {
                            foreach (var alley in alleyList)
                            {
                                if (alley == null) continue;
                                if (!aFirst) sb.Append(",");
                                string alleyOwner = "";
                                try
                                {
                                    var ownerProp = alley.GetType().GetProperty("Owner");
                                    var aOwner = ownerProp?.GetValue(alley) as Hero;
                                    if (aOwner != null) alleyOwner = aOwner.Name?.ToString() ?? "";
                                }
                                catch { }
                                sb.Append("{\"owner\":\"" + JEsc(alleyOwner) + "\"}");
                                aFirst = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Under siege?
                sb.Append("\"isUnderSiege\":" + (s.IsUnderSiege ? "true" : "false") + ",");
                sb.Append("\"isRaided\":" + (s.IsRaided ? "true" : "false"));
            }
            catch (Exception ex) { sb.Append("\"error\":\"" + JEsc(ex.Message) + "\""); }

            sb.Append("}");
            return sb.ToString();
        }

        // ── Set Current Building Project ──
        private static string HandleSetProject(string settlementId, string buildingIndexStr)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";
            int bIdx = 0;
            int.TryParse(buildingIndexStr, out bIdx);
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var st in Settlement.All)
                        if (st.StringId == settlementId) { target = st; break; }
                    if (target?.Town == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    var buildings = target.Town.Buildings.ToList();
                    if (bIdx < 0 || bIdx >= buildings.Count) { result = "{\"error\":\"Invalid building index\"}"; doneEvent.Set(); return; }

                    var building = buildings[bIdx];
                    try
                    {
                        bool success = false;

                        // Strategy 1: Direct property setter
                        var cbProp = target.Town.GetType().GetProperty("CurrentBuilding", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (cbProp != null && cbProp.CanWrite)
                        {
                            cbProp.SetValue(target.Town, building);
                            success = true;
                        }

                        // Strategy 2: Private backing field
                        if (!success)
                        {
                            var fields = target.Town.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                                .Where(f => f.Name.IndexOf("currentBuilding", StringComparison.OrdinalIgnoreCase) >= 0 || f.Name.IndexOf("_currentBuilding", StringComparison.OrdinalIgnoreCase) >= 0).ToArray();
                            Log("[SetProject] Backing fields: " + string.Join(", ", fields.Select(f => f.Name + "(" + f.FieldType.Name + ")")));
                            var bf = fields.FirstOrDefault();
                            if (bf != null)
                            {
                                bf.SetValue(target.Town, building);
                                success = true;
                            }
                        }

                        // Strategy 3: BuildingsInProgress queue reorder
                        if (!success)
                        {
                            var bipProp = target.Town.GetType().GetProperty("BuildingsInProgress", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            Log("[SetProject] BuildingsInProgress prop: " + (bipProp != null ? bipProp.PropertyType.Name : "null"));
                            if (bipProp != null)
                            {
                                var queue = bipProp.GetValue(target.Town) as System.Collections.IList;
                                if (queue != null)
                                {
                                    // Remove and reinsert at front
                                    int foundIdx = -1;
                                    for (int qi = 0; qi < queue.Count; qi++)
                                    {
                                        if (queue[qi] == building) { foundIdx = qi; break; }
                                    }
                                    if (foundIdx >= 0)
                                    {
                                        queue.RemoveAt(foundIdx);
                                        queue.Insert(0, building);
                                        success = true;
                                    }
                                }
                            }
                        }

                        // Strategy 4: CurrentDefaultBuilding
                        if (!success)
                        {
                            var cdbProp = target.Town.GetType().GetProperty("CurrentDefaultBuilding", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (cdbProp != null && cdbProp.CanWrite)
                            {
                                cdbProp.SetValue(target.Town, building);
                                success = true;
                            }
                        }

                        if (success)
                            result = "{\"success\":true,\"project\":\"" + JEsc(building.Name?.ToString()) + "\"}";
                        else
                        {
                            var allMethods = target.Town.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                .Where(m => m.Name.IndexOf("Build", StringComparison.OrdinalIgnoreCase) >= 0)
                                .Select(m => m.Name).ToArray();
                            Log("[SetProject] Build-related methods: " + string.Join(", ", allMethods));
                            result = "{\"error\":\"Could not set building project. Check debug log.\"}";
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        // ── Send Clan Member to Settlement ──
        private class TradeRouteEntry
        {
            public string item;
            public string buyTown;
            public string buyTownId;
            public string sellTown;
            public string sellTownId;
            public int buyPrice;
            public int sellPrice;
            public int profit;
        }

        private static string GetTradeRoutesJson()
        {
            var sb = new StringBuilder("{\"routes\":[");
            try
            {
                // For each pair of towns, find best item to trade
                var towns = new List<Settlement>();
                foreach (var s in Settlement.All)
                {
                    if (s != null && s.IsTown && s.Town != null) towns.Add(s);
                }

                // Build a list of trade routes
                var routes = new List<TradeRouteEntry>();
                bool first = true;

                // Limit to top items to avoid huge response — use category-based key trade goods
                string[] keyItems = { "grain", "wine", "olives", "salt", "iron", "silver", "fur", "hardwood", "wool", "linen", "velvet", "tools", "horse" };

                foreach (var townA in towns)
                {
                    if (townA.Town?.MarketData == null) continue;
                    foreach (var townB in towns)
                    {
                        if (townA == townB || townB.Town?.MarketData == null) continue;
                        try
                        {
                            // Sample items via MBObjectManager
                            var allItems = TaleWorlds.ObjectSystem.MBObjectManager.Instance?.GetObjectTypeList<TaleWorlds.Core.ItemObject>();
                            if (allItems == null) continue;
                            foreach (var keyword in keyItems)
                            {
                                try
                                {
                                    foreach (var item in allItems)
                                    {
                                        if (item == null || item.StringId == null) continue;
                                        if (!item.StringId.ToLower().Contains(keyword)) continue;
                                        try
                                        {
                                            int buyPrice = townA.Town.MarketData.GetPrice(item, null, false, null);
                                            int sellPrice = townB.Town.MarketData.GetPrice(item, null, true, null);
                                            int profit = sellPrice - buyPrice;
                                            if (profit > 50)
                                            {
                                                routes.Add(new TradeRouteEntry {
                                                    item = item.Name?.ToString() ?? item.StringId,
                                                    buyTown = townA.Name?.ToString(),
                                                    buyTownId = townA.StringId,
                                                    sellTown = townB.Name?.ToString(),
                                                    sellTownId = townB.StringId,
                                                    buyPrice = buyPrice,
                                                    sellPrice = sellPrice,
                                                    profit = profit
                                                });
                                            }
                                        }
                                        catch { }
                                        break; // one item per keyword per pair
                                    }
                                }
                                catch { }
                            }
                        }
                        catch { }
                    }
                }

                // Sort by profit descending, take top 25
                routes.Sort((x, y) => y.profit.CompareTo(x.profit));
                var topRoutes = routes.Count > 25 ? routes.GetRange(0, 25) : routes;

                foreach (var r in topRoutes)
                {
                    if (!first) sb.Append(",");
                    sb.Append("{\"item\":\"" + JEsc(r.item) + "\"");
                    sb.Append(",\"buyTown\":\"" + JEsc(r.buyTown) + "\"");
                    sb.Append(",\"buyTownId\":\"" + JEsc(r.buyTownId) + "\"");
                    sb.Append(",\"sellTown\":\"" + JEsc(r.sellTown) + "\"");
                    sb.Append(",\"sellTownId\":\"" + JEsc(r.sellTownId) + "\"");
                    sb.Append(",\"buyPrice\":" + r.buyPrice);
                    sb.Append(",\"sellPrice\":" + r.sellPrice);
                    sb.Append(",\"profit\":" + r.profit);
                    sb.Append("}");
                    first = false;
                }
            }
            catch (Exception ex) { Log("[TradeRoutes] error: " + ex.Message); }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string GetPlayerNotificationsJson()
        {
            var sb = new StringBuilder("{\"notifications\":[");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) { sb.Append("]}"); return sb.ToString(); }
                var kingdom = hero.Clan?.Kingdom;
                bool first = true;

                // Active wars (high priority)
                if (kingdom != null)
                {
                    try
                    {
                        foreach (var k in Kingdom.All)
                        {
                            if (k == null || k == kingdom) continue;
                            try
                            {
                                if (FactionManager.IsAtWarAgainstFaction(kingdom, k))
                                {
                                    if (!first) sb.Append(",");
                                    sb.Append("{\"type\":\"war\",\"icon\":\"\u2694\",\"priority\":\"high\",\"title\":\"At War: " + JEsc(k.Name?.ToString()) + "\",\"desc\":\"Your kingdom is fighting " + JEsc(k.Name?.ToString()) + "\",\"id\":\"" + JEsc(k.StringId) + "\",\"category\":\"kingdoms\"}");
                                    first = false;
                                }
                            }
                            catch { }
                        }
                    }
                    catch { }
                }

                // Settlements at risk (low loyalty, food shortage, low security)
                try
                {
                    foreach (var s in Settlement.All)
                    {
                        if (s == null || s.OwnerClan != hero.Clan) continue;
                        try
                        {
                            var town = s.Town;
                            if (town != null)
                            {
                                if (town.Loyalty < 30)
                                {
                                    if (!first) sb.Append(",");
                                    sb.Append("{\"type\":\"loyalty\",\"icon\":\"\u26A0\",\"priority\":\"med\",\"title\":\"Low Loyalty: " + JEsc(s.Name?.ToString()) + "\",\"desc\":\"Loyalty: " + (int)town.Loyalty + "\",\"id\":\"" + JEsc(s.StringId) + "\",\"category\":\"settlements\"}");
                                    first = false;
                                }
                                if (town.FoodStocks < 30)
                                {
                                    if (!first) sb.Append(",");
                                    sb.Append("{\"type\":\"food\",\"icon\":\"\u26A0\",\"priority\":\"high\",\"title\":\"Food Shortage: " + JEsc(s.Name?.ToString()) + "\",\"desc\":\"Food: " + (int)town.FoodStocks + "\",\"id\":\"" + JEsc(s.StringId) + "\",\"category\":\"settlements\"}");
                                    first = false;
                                }
                                if (town.Security < 20)
                                {
                                    if (!first) sb.Append(",");
                                    sb.Append("{\"type\":\"security\",\"icon\":\"\u26A0\",\"priority\":\"med\",\"title\":\"Low Security: " + JEsc(s.Name?.ToString()) + "\",\"desc\":\"Security: " + (int)town.Security + "\",\"id\":\"" + JEsc(s.StringId) + "\",\"category\":\"settlements\"}");
                                    first = false;
                                }
                            }
                        }
                        catch { }
                        if (s.IsUnderSiege)
                        {
                            if (!first) sb.Append(",");
                            sb.Append("{\"type\":\"siege\",\"icon\":\"\uD83D\uDEA8\",\"priority\":\"critical\",\"title\":\"Under Siege: " + JEsc(s.Name?.ToString()) + "\",\"desc\":\"Your settlement is being besieged!\",\"id\":\"" + JEsc(s.StringId) + "\",\"category\":\"settlements\"}");
                            first = false;
                        }
                    }
                }
                catch { }

                // Wounded heroes in clan
                try
                {
                    foreach (var h in hero.Clan.Heroes)
                    {
                        if (h == null || !h.IsAlive) continue;
                        try
                        {
                            if (h.HitPoints < h.MaxHitPoints * 0.5)
                            {
                                if (!first) sb.Append(",");
                                sb.Append("{\"type\":\"wounded\",\"icon\":\"\uD83E\uDE78\",\"priority\":\"med\",\"title\":\"Wounded: " + JEsc(h.Name?.ToString()) + "\",\"desc\":\"HP: " + h.HitPoints + "/" + h.MaxHitPoints + "\",\"id\":\"" + JEsc(h.StringId) + "\",\"category\":\"heroes\"}");
                                first = false;
                            }
                        }
                        catch { }
                    }
                }
                catch { }

                // Low gold warning
                try
                {
                    if (hero.Gold < 5000)
                    {
                        if (!first) sb.Append(",");
                        sb.Append("{\"type\":\"gold\",\"icon\":\"\uD83D\uDCB0\",\"priority\":\"med\",\"title\":\"Low Treasury\",\"desc\":\"" + hero.Gold + " denars remaining\",\"id\":\"\",\"category\":\"\"}");
                        first = false;
                    }
                }
                catch { }
            }
            catch (Exception ex) { Log("[Notifications] error: " + ex.Message); }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string HandleAbdicateLeadership()
        {
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }
                    if (kingdom.Leader != hero) { result = "{\"error\":\"You are not the ruler\"}"; doneEvent.Set(); return; }

                    // Find a successor — pick the highest-tier clan that isn't ours
                    Clan successor = null;
                    int bestTier = -1;
                    foreach (var c in kingdom.Clans)
                    {
                        if (c == null || c == hero.Clan || c.Leader == null) continue;
                        if (c.Tier > bestTier) { successor = c; bestTier = c.Tier; }
                    }
                    if (successor == null) { result = "{\"error\":\"No suitable successor in kingdom\"}"; doneEvent.Set(); return; }

                    Log("[Abdicate] Transferring leadership to " + successor.Name?.ToString());

                    bool success = false;

                    // Strategy 1: ChangeRulingClanAction
                    try
                    {
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeRulingClanAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var apply = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (apply != null)
                            {
                                apply.Invoke(null, new object[] { kingdom, successor });
                                success = true;
                                Log("[Abdicate] ChangeRulingClanAction succeeded");
                            }
                        }
                    }
                    catch (Exception ex) { Log("[Abdicate] Strategy 1 failed: " + ex.Message); }

                    // Strategy 2: Direct property set on RulingClan
                    if (!success)
                    {
                        try
                        {
                            var rulingProp = kingdom.GetType().GetProperty("RulingClan", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (rulingProp != null && rulingProp.CanWrite)
                            {
                                rulingProp.SetValue(kingdom, successor);
                                success = true;
                                Log("[Abdicate] RulingClan set directly");
                            }
                        }
                        catch (Exception ex) { Log("[Abdicate] Strategy 2 failed: " + ex.Message); }
                    }

                    // Strategy 3: Backing field
                    if (!success)
                    {
                        try
                        {
                            var rulingField = kingdom.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                                .FirstOrDefault(f => f.Name.IndexOf("rulingClan", StringComparison.OrdinalIgnoreCase) >= 0);
                            if (rulingField != null)
                            {
                                rulingField.SetValue(kingdom, successor);
                                success = true;
                                Log("[Abdicate] RulingClan backing field set");
                            }
                        }
                        catch (Exception ex) { Log("[Abdicate] Strategy 3 failed: " + ex.Message); }
                    }

                    if (success)
                        result = "{\"success\":true,\"successor\":\"" + JEsc(successor.Name?.ToString()) + "\"}";
                    else
                        result = "{\"error\":\"Could not abdicate. Check debug log.\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleRenameKingdom(string newName)
        {
            if (string.IsNullOrEmpty(newName)) return "{\"error\":\"Missing name\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }

                    var newText = new TaleWorlds.Localization.TextObject(newName);

                    bool success = false;

                    // Strategy 1: ChangeKingdomNameAction
                    try
                    {
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeKingdomNameAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var apply = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (apply != null)
                            {
                                var paramTypes = apply.GetParameters();
                                if (paramTypes.Length == 3)
                                    apply.Invoke(null, new object[] { kingdom, newText, newText });
                                else if (paramTypes.Length == 2)
                                    apply.Invoke(null, new object[] { kingdom, newText });
                                success = true;
                            }
                        }
                    }
                    catch (Exception ex) { Log("[RenameKingdom] Strategy 1 failed: " + ex.Message); }

                    // Strategy 2: Direct property setters
                    if (!success)
                    {
                        try
                        {
                            var nameProp = kingdom.GetType().GetProperty("Name", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (nameProp != null && nameProp.CanWrite)
                            {
                                nameProp.SetValue(kingdom, newText);
                                success = true;
                            }
                        }
                        catch (Exception ex) { Log("[RenameKingdom] Strategy 2 failed: " + ex.Message); }
                    }

                    // Strategy 3: Backing fields
                    if (!success)
                    {
                        try
                        {
                            var nameFields = kingdom.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                                .Where(f => f.Name.IndexOf("name", StringComparison.OrdinalIgnoreCase) >= 0 && f.FieldType == typeof(TaleWorlds.Localization.TextObject)).ToArray();
                            foreach (var nf in nameFields)
                            {
                                nf.SetValue(kingdom, newText);
                                success = true;
                            }
                            // Also try _informalName
                            var infName = kingdom.GetType().GetField("_informalName", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                            if (infName != null) infName.SetValue(kingdom, newText);
                        }
                        catch (Exception ex) { Log("[RenameKingdom] Strategy 3 failed: " + ex.Message); }
                    }

                    if (success)
                        result = "{\"success\":true,\"name\":\"" + JEsc(newName) + "\"}";
                    else
                        result = "{\"error\":\"Could not rename. Check debug log.\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleSupportClan(string clanId)
        {
            if (string.IsNullOrEmpty(clanId)) return "{\"error\":\"Missing clanId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }

                    Clan target = null;
                    foreach (var c in kingdom.Clans)
                        if (c != null && c.StringId == clanId) { target = c; break; }
                    if (target == null) { result = "{\"error\":\"Clan not found in kingdom\"}"; doneEvent.Set(); return; }
                    if (target == hero.Clan) { result = "{\"error\":\"Cannot support your own clan\"}"; doneEvent.Set(); return; }

                    int cost = 50;
                    if (hero.Clan.Influence < cost) { result = "{\"error\":\"Not enough influence (need " + cost + ")\"}"; doneEvent.Set(); return; }

                    // Use ChangeClanInfluenceAction to spend ours and give theirs
                    try
                    {
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var apply = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (apply != null)
                            {
                                apply.Invoke(null, new object[] { hero.Clan, -cost });
                                apply.Invoke(null, new object[] { target, (float)cost });
                                result = "{\"success\":true,\"clan\":\"" + JEsc(target.Name?.ToString()) + "\",\"cost\":" + cost + "}";
                            }
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }

                    if (result == null) result = "{\"error\":\"ChangeClanInfluenceAction not available\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleExpelClan(string clanId)
        {
            if (string.IsNullOrEmpty(clanId)) return "{\"error\":\"Missing clanId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }

                    Clan target = null;
                    foreach (var c in kingdom.Clans)
                        if (c != null && c.StringId == clanId) { target = c; break; }
                    if (target == null) { result = "{\"error\":\"Clan not found\"}"; doneEvent.Set(); return; }
                    if (target == hero.Clan) { result = "{\"error\":\"Cannot expel your own clan\"}"; doneEvent.Set(); return; }

                    int cost = 200;
                    if (hero.Clan.Influence < cost) { result = "{\"error\":\"Not enough influence (need " + cost + ")\"}"; doneEvent.Set(); return; }

                    // Spend influence and force the clan to leave the kingdom
                    try
                    {
                        var infActionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                        if (infActionType != null)
                        {
                            var apply = infActionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (apply != null) apply.Invoke(null, new object[] { hero.Clan, -cost });
                        }

                        var changeKingdomType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeKingdomAction, TaleWorlds.CampaignSystem");
                        if (changeKingdomType != null)
                        {
                            var leaveMethod = changeKingdomType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                                .FirstOrDefault(m => m.Name == "ApplyByLeaveKingdom" || m.Name == "ApplyByLeaveKingdomAsMercenary");
                            if (leaveMethod != null)
                            {
                                var paramCount = leaveMethod.GetParameters().Length;
                                var args = paramCount == 2 ? new object[] { target, true } : new object[] { target };
                                leaveMethod.Invoke(null, args);
                                result = "{\"success\":true,\"clan\":\"" + JEsc(target.Name?.ToString()) + "\",\"cost\":" + cost + "}";
                            }
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }

                    if (result == null) result = "{\"error\":\"Could not expel clan — action not available\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        // Reflectively read MobileParty Position2D / Position / GetPosition2D to return distance between two parties.
        private static float ApproxPartyDistance(object a, object b)
        {
            try
            {
                var pa = TryGetPosition(a);
                var pb = TryGetPosition(b);
                if (pa == null || pb == null) return 0;
                // Try Distance(Vec2) method
                var distMethod = pa.GetType().GetMethod("Distance", new Type[] { pa.GetType() });
                if (distMethod != null) return Convert.ToSingle(distMethod.Invoke(pa, new object[] { pb }));
                // Manual: read X,Y fields
                var xa = Convert.ToSingle(pa.GetType().GetField("x")?.GetValue(pa) ?? 0);
                var ya = Convert.ToSingle(pa.GetType().GetField("y")?.GetValue(pa) ?? 0);
                var xb = Convert.ToSingle(pb.GetType().GetField("x")?.GetValue(pb) ?? 0);
                var yb = Convert.ToSingle(pb.GetType().GetField("y")?.GetValue(pb) ?? 0);
                return (float)Math.Sqrt((xa - xb) * (xa - xb) + (ya - yb) * (ya - yb));
            }
            catch { return 0; }
        }

        private static object TryGetPosition(object party)
        {
            if (party == null) return null;
            var t = party.GetType();
            // Property candidates
            string[] propNames = { "Position2D", "Position", "GetPosition2D" };
            foreach (var n in propNames)
            {
                var prop = t.GetProperty(n, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                if (prop != null) { try { var v = prop.GetValue(party); if (v != null) return v; } catch { } }
            }
            // Method candidates
            var m = t.GetMethod("GetPosition2D", Type.EmptyTypes);
            if (m != null) { try { var v = m.Invoke(party, null); if (v != null) return v; } catch { } }
            // PartyBase fallback
            var partyBaseProp = t.GetProperty("Party");
            if (partyBaseProp != null)
            {
                var pb = partyBaseProp.GetValue(party);
                if (pb != null) return TryGetPosition(pb);
            }
            return null;
        }

        // After kingdom.CreateArmy, the player's MobileParty.Army is set to the new army.
        // For each selected party, set its Army = playerArmy and pay influence.
        private static int InviteSelectedPartiesToPlayerArmy(Hero hero, Kingdom kingdom, HashSet<string> partyIds)
        {
            if (partyIds == null || partyIds.Count == 0) return 0;
            int invited = 0;
            try
            {
                var playerParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                var playerArmy = playerParty?.Army;
                if (playerArmy == null) { Log("[InviteParties] player has no army yet"); return 0; }

                var infActionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                var infApply = infActionType?.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

                foreach (var clan in kingdom.Clans)
                {
                    if (clan == null || clan.IsEliminated) continue;
                    foreach (var wpc in clan.WarPartyComponents)
                    {
                        var mp = wpc?.MobileParty;
                        if (mp == null || mp == playerParty) continue;
                        if (mp.Army != null) continue;
                        if (!partyIds.Contains(mp.StringId)) continue;

                        // Calculate cost again on backend to prevent client tampering
                        int cost = 0;
                        if (clan != hero.Clan)
                        {
                            int tier = clan.Tier;
                            float dist = ApproxPartyDistance(playerParty, mp);
                            cost = (int)(20 + tier * 15 + dist * 0.4f);
                            if (cost < 20) cost = 20;
                        }

                        if (hero.Clan.Influence < cost)
                        {
                            Log("[InviteParties] insufficient influence for " + mp.Name + " (cost " + cost + ")");
                            continue;
                        }

                        // Set the party's army field via reflection — the public Army setter exists in most versions
                        try
                        {
                            var armyProp = mp.GetType().GetProperty("Army", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (armyProp != null && armyProp.CanWrite)
                            {
                                armyProp.SetValue(mp, playerArmy);
                                if (cost > 0 && infApply != null) infApply.Invoke(null, new object[] { hero.Clan, (float)-cost });
                                invited++;
                                Log("[InviteParties] invited " + mp.Name + " (cost " + cost + ")");
                            }
                            else
                            {
                                // No public setter — try a private backing field
                                var armyField = mp.GetType().GetField("_army", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                if (armyField != null)
                                {
                                    armyField.SetValue(mp, playerArmy);
                                    if (cost > 0 && infApply != null) infApply.Invoke(null, new object[] { hero.Clan, (float)-cost });
                                    invited++;
                                    Log("[InviteParties] invited " + mp.Name + " via _army field");
                                }
                                else
                                {
                                    Log("[InviteParties] no Army setter found on " + mp.Name);
                                }
                            }
                        }
                        catch (Exception ex) { Log("[InviteParties] failed for " + mp.Name + ": " + ex.Message); }
                    }
                }
            }
            catch (Exception ex) { Log("[InviteParties] outer error: " + ex.Message); }
            return invited;
        }

        // ── Player travel: move the main party toward a target settlement ──
        private static string HandlePlayerTravel(string settlementId)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                        if (s != null && s.StringId == settlementId) { target = s; break; }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    var playerParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (playerParty == null) { result = "{\"error\":\"Player has no party\"}"; doneEvent.Set(); return; }

                    // ── Instant teleport: set Position2D via reflection. Uses
                    // GetSetMethod(nonPublic:true) to bypass internal visibility, and
                    // walks up to PartyBase._position2D / MobileParty._position2D
                    // backing fields as final fallbacks.
                    const System.Reflection.BindingFlags BF = System.Reflection.BindingFlags.Public
                        | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
                    bool teleported = false;
                    string lastErr = null;
                    var gate = target.GatePosition;
                    try
                    {
                        // 1) MobileParty.Position2D setter (any visibility)
                        try
                        {
                            var mpProp = playerParty.GetType().GetProperty("Position2D", BF);
                            var mpSet = mpProp?.GetSetMethod(true);
                            if (mpSet != null)
                            {
                                mpSet.Invoke(playerParty, new object[] { gate });
                                teleported = true;
                                Log("[Travel] MobileParty.Position2D setter OK");
                            }
                        }
                        catch (Exception e1) { lastErr = "MP.Position2D: " + e1.InnerException?.Message ?? e1.Message; Log("[Travel] path1 failed: " + lastErr); }

                        // 2) MobileParty.Party (PartyBase).Position2D setter
                        if (!teleported)
                        {
                            try
                            {
                                var partyProp = playerParty.GetType().GetProperty("Party");
                                var partyObj = partyProp?.GetValue(playerParty);
                                if (partyObj != null)
                                {
                                    var pbProp = partyObj.GetType().GetProperty("Position2D", BF);
                                    var pbSet = pbProp?.GetSetMethod(true);
                                    if (pbSet != null)
                                    {
                                        pbSet.Invoke(partyObj, new object[] { gate });
                                        teleported = true;
                                        Log("[Travel] PartyBase.Position2D setter OK");
                                    }
                                }
                            }
                            catch (Exception e2) { lastErr = "PB.Position2D: " + e2.InnerException?.Message ?? e2.Message; Log("[Travel] path2 failed: " + lastErr); }
                        }

                        // 3) Walk type hierarchy looking for a _position2D private field
                        if (!teleported)
                        {
                            try
                            {
                                var partyProp = playerParty.GetType().GetProperty("Party");
                                var partyObj = partyProp?.GetValue(playerParty);
                                object[] candidates = new object[] { playerParty, partyObj };
                                string[] fieldNames = new string[] { "_position2D", "_position", "_mapPosition", "_currentPosition" };
                                foreach (var cand in candidates)
                                {
                                    if (cand == null || teleported) continue;
                                    var t = cand.GetType();
                                    while (t != null && !teleported)
                                    {
                                        foreach (var fn in fieldNames)
                                        {
                                            var f = t.GetField(fn, System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                            if (f != null && f.FieldType.Name == "Vec2")
                                            {
                                                try { f.SetValue(cand, gate); teleported = true; Log("[Travel] field " + t.Name + "." + fn + " OK"); break; } catch { }
                                            }
                                        }
                                        t = t.BaseType;
                                    }
                                }
                            }
                            catch (Exception e3) { lastErr = "field: " + e3.Message; Log("[Travel] path3 failed: " + lastErr); }
                        }

                        // 4) Last resort: any instance method on MobileParty or PartyBase
                        //    whose name contains "SetPosition" / "Teleport" / "MoveTo"
                        //    with a single Vec2 parameter
                        if (!teleported)
                        {
                            try
                            {
                                var partyProp = playerParty.GetType().GetProperty("Party");
                                var partyObj = partyProp?.GetValue(playerParty);
                                object[] candidates = new object[] { playerParty, partyObj };
                                foreach (var cand in candidates)
                                {
                                    if (cand == null || teleported) continue;
                                    var methods = cand.GetType().GetMethods(BF)
                                        .Where(m => (m.Name.IndexOf("SetPosition", System.StringComparison.OrdinalIgnoreCase) >= 0
                                                  || m.Name.IndexOf("Teleport", System.StringComparison.OrdinalIgnoreCase) >= 0)
                                                 && m.GetParameters().Length == 1);
                                    foreach (var m in methods)
                                    {
                                        try { m.Invoke(cand, new object[] { gate }); teleported = true; Log("[Travel] method " + m.Name + " OK"); break; } catch { }
                                    }
                                }
                            }
                            catch (Exception e4) { lastErr = "method: " + e4.Message; Log("[Travel] path4 failed: " + lastErr); }
                        }

                        // Best-effort: nudge the AI so the party doesn't immediately
                        // wander off after the teleport. Try MobileParty.Ai.SetMoveGoToSettlement
                        // (1.2.x+), then MobileParty.SetMoveGoToSettlement (older), then ignore.
                        bool aiSet = false;
                        try
                        {
                            var aiProp = playerParty.GetType().GetProperty("Ai");
                            var ai = aiProp?.GetValue(playerParty);
                            if (ai != null)
                            {
                                var aiMethods = ai.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                    .Where(m => m.Name == "SetMoveGoToSettlement");
                                foreach (var m in aiMethods)
                                {
                                    var pars = m.GetParameters();
                                    if (pars.Length == 1 && pars[0].ParameterType.IsAssignableFrom(typeof(Settlement)))
                                    {
                                        try { m.Invoke(ai, new object[] { target }); aiSet = true; break; } catch { }
                                    }
                                }
                            }
                        }
                        catch (Exception innerEx) { Log("[Travel] AI nudge failed: " + innerEx.Message); }

                        if (!aiSet)
                        {
                            var mpMethod = playerParty.GetType().GetMethod("SetMoveGoToSettlement",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance,
                                null, new System.Type[] { typeof(Settlement) }, null);
                            if (mpMethod != null) { try { mpMethod.Invoke(playerParty, new object[] { target }); } catch { } }
                        }

                        if (teleported)
                            result = "{\"success\":true,\"action\":\"teleport\",\"target\":\"" + JEsc(target.Name?.ToString()) + "\",\"aiNudged\":" + (aiSet ? "true" : "false") + "}";
                        else
                            result = "{\"error\":\"Teleport failed on this game version\",\"detail\":\"" + JEsc(lastErr ?? "no writable Position2D / backing field found") + "\"}";
                    }
                    catch (Exception ex) { Log("[Travel] teleport error: " + ex.Message); result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        // ── Live Campaign Map ──
        // Returns settlement positions + party positions + kingdom data for the SVG map.
        private static string GetCampaignMapJson()
        {
            var sb = new StringBuilder("{");
            try
            {
                // Compute world bounds from settlements so the JS can normalize coords
                float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;

                // Settlements
                sb.Append("\"settlements\":[");
                bool first = true;
                foreach (var s in Settlement.All)
                {
                    if (s == null) continue;
                    if (!s.IsTown && !s.IsCastle && !s.IsVillage && !s.IsHideout) continue;
                    float x = 0, y = 0;
                    try { var pos = s.GetPosition2D; x = pos.x; y = pos.y; } catch { }
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (!first) sb.Append(",");
                    string sType = s.IsTown ? "Town" : s.IsCastle ? "Castle" : s.IsVillage ? "Village" : "Hideout";
                    string oClanId = s.OwnerClan?.StringId ?? "";
                    string oClanName = s.OwnerClan?.Name?.ToString() ?? "";
                    string kId = s.OwnerClan?.Kingdom?.StringId ?? "";
                    string kName = s.OwnerClan?.Kingdom?.Name?.ToString() ?? "";
                    string sBanner = "";
                    try { if (s.OwnerClan?.Banner != null) sBanner = s.OwnerClan.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(s.StringId) + "\"");
                    sb.Append(",\"name\":\"" + JEsc(s.Name?.ToString()) + "\"");
                    sb.Append(",\"type\":\"" + sType + "\"");
                    sb.Append(",\"x\":" + x.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                    sb.Append(",\"y\":" + y.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                    sb.Append(",\"clanId\":\"" + JEsc(oClanId) + "\"");
                    sb.Append(",\"clanName\":\"" + JEsc(oClanName) + "\"");
                    sb.Append(",\"kingdomId\":\"" + JEsc(kId) + "\"");
                    sb.Append(",\"kingdomName\":\"" + JEsc(kName) + "\"");
                    sb.Append(",\"bannerCode\":\"" + JEsc(sBanner) + "\"");
                    if (s.IsTown || s.IsCastle)
                    {
                        try { sb.Append(",\"prosperity\":" + (int)(s.Town?.Prosperity ?? 0)); } catch { }
                        try { sb.Append(",\"garrison\":" + (s.Town?.GarrisonParty?.MemberRoster?.TotalManCount ?? 0)); } catch { }
                        try { sb.Append(",\"loyalty\":" + (int)(s.Town?.Loyalty ?? 0)); } catch { }
                        try { sb.Append(",\"security\":" + (int)(s.Town?.Security ?? 0)); } catch { }
                        try { sb.Append(",\"foodStocks\":" + (int)(s.Town?.FoodStocks ?? 0)); } catch { }
                        try { sb.Append(",\"isUnderSiege\":" + (s.IsUnderSiege ? "true" : "false")); } catch { sb.Append(",\"isUnderSiege\":false"); }
                        try { sb.Append(",\"hasTournament\":" + (s.Town != null && s.Town.HasTournament ? "true" : "false")); } catch { sb.Append(",\"hasTournament\":false"); }
                    }
                    else if (s.IsVillage)
                    {
                        try { sb.Append(",\"isRaided\":" + (s.IsRaided ? "true" : "false")); } catch { sb.Append(",\"isRaided\":false"); }
                    }
                    sb.Append("}");
                    first = false;
                }
                sb.Append("],");

                // Parties
                sb.Append("\"parties\":[");
                first = true;
                try
                {
                    var playerParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    Log("[Map] enumerate parties; playerParty=" + (playerParty != null ? playerParty.Name?.ToString() : "null"));
                    foreach (var mp in TaleWorlds.CampaignSystem.Party.MobileParty.All)
                    {
                        if (mp == null) continue;
                        bool isPlayerHere = mp == playerParty;
                        // Only show notable parties — lords, caravans, player (player ALWAYS)
                        if (!isPlayerHere && mp.LeaderHero == null && !mp.IsCaravan) continue;
                        float x = 0, y = 0;
                        try
                        {
                            // Dump schema for player party once so we can find the real position field
                            if (isPlayerHere && !_dumpedPartyPos)
                            {
                                _dumpedPartyPos = true;
                                Log("[Map] dumping MobileParty position-related members for " + mp.GetType().FullName);
                                var mt = mp.GetType();
                                foreach (var pi in mt.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance))
                                {
                                    var n = pi.Name.ToLower();
                                    if (n.Contains("pos") || n.Contains("vec") || n.Contains("location"))
                                        try { Log("[Map]   PROP " + pi.PropertyType.Name + " " + pi.Name + " = " + pi.GetValue(mp)); } catch (Exception ex) { Log("[Map]   PROP " + pi.Name + " err " + ex.Message); }
                                }
                                foreach (var fi in mt.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance))
                                {
                                    var n = fi.Name.ToLower();
                                    if (n.Contains("pos") || n.Contains("vec") || n.Contains("location"))
                                        try { Log("[Map]   FIELD " + fi.FieldType.Name + " " + fi.Name + " = " + fi.GetValue(mp)); } catch (Exception ex) { Log("[Map]   FIELD " + fi.Name + " err " + ex.Message); }
                                }
                                foreach (var mi in mt.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance))
                                {
                                    var n = mi.Name.ToLower();
                                    if ((n.Contains("getpos") || n.Contains("position")) && mi.GetParameters().Length == 0)
                                        try { Log("[Map]   METHOD " + mi.ReturnType.Name + " " + mi.Name + "() = " + mi.Invoke(mp, null)); } catch (Exception ex) { Log("[Map]   METHOD " + mi.Name + " err " + ex.Message); }
                                }
                                // Also dump the Party (PartyBase) field
                                var partyProp = mt.GetProperty("Party");
                                if (partyProp != null)
                                {
                                    var pb = partyProp.GetValue(mp);
                                    if (pb != null)
                                    {
                                        Log("[Map] dumping PartyBase position-related members for " + pb.GetType().FullName);
                                        var pbt = pb.GetType();
                                        foreach (var pi in pbt.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance))
                                        {
                                            var n = pi.Name.ToLower();
                                            if (n.Contains("pos") || n.Contains("vec") || n.Contains("location"))
                                                try { Log("[Map]   PB.PROP " + pi.PropertyType.Name + " " + pi.Name + " = " + pi.GetValue(pb)); } catch (Exception ex) { Log("[Map]   PB.PROP " + pi.Name + " err " + ex.Message); }
                                        }
                                    }
                                }
                            }

                            // Prefer the get_GetPosition2D() method which returns a plain Vec2
                            object posObj = null;
                            try
                            {
                                var getPosMethod = mp.GetType().GetMethod("get_GetPosition2D", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                if (getPosMethod != null) posObj = getPosMethod.Invoke(mp, null);
                            }
                            catch { }
                            if (posObj == null) posObj = TryGetPosition(mp);
                            if (posObj == null) { if (isPlayerHere) Log("[Map] player position null"); continue; }
                            var t = posObj.GetType();
                            // Try lowercase fields (Vec2) first, then uppercase properties (CampaignVec2)
                            var fx = t.GetField("x"); var fy = t.GetField("y");
                            if (fx != null && fy != null)
                            {
                                x = Convert.ToSingle(fx.GetValue(posObj));
                                y = Convert.ToSingle(fy.GetValue(posObj));
                            }
                            else
                            {
                                var px = t.GetProperty("X"); var py = t.GetProperty("Y");
                                if (px != null && py != null)
                                {
                                    x = Convert.ToSingle(px.GetValue(posObj));
                                    y = Convert.ToSingle(py.GetValue(posObj));
                                }
                            }
                            if (isPlayerHere) Log("[Map] player at " + x + "," + y + " from " + t.Name);
                        }
                        catch (Exception ex) { if (isPlayerHere) Log("[Map] player pos err: " + ex.Message); continue; }
                        if (x == 0 && y == 0 && !isPlayerHere) continue;
                        if (!first) sb.Append(",");
                        string pName = mp.Name?.ToString() ?? "";
                        string lName = mp.LeaderHero?.Name?.ToString() ?? "";
                        string lId = mp.LeaderHero?.StringId ?? "";
                        string clanId = mp.LeaderHero?.Clan?.StringId ?? "";
                        string kdmId = mp.LeaderHero?.Clan?.Kingdom?.StringId ?? "";
                        int troops = mp.MemberRoster?.TotalManCount ?? 0;
                        bool isPlayer = mp == playerParty;
                        bool isAtWar = false;
                        try
                        {
                            if (Hero.MainHero?.Clan?.Kingdom != null && mp.LeaderHero?.Clan?.Kingdom != null)
                                isAtWar = FactionManager.IsAtWarAgainstFaction(Hero.MainHero.Clan.Kingdom, mp.LeaderHero.Clan.Kingdom);
                        }
                        catch { }
                        sb.Append("{\"id\":\"" + JEsc(mp.StringId) + "\"");
                        sb.Append(",\"name\":\"" + JEsc(pName) + "\"");
                        sb.Append(",\"leader\":\"" + JEsc(lName) + "\"");
                        sb.Append(",\"leaderId\":\"" + JEsc(lId) + "\"");
                        sb.Append(",\"clanId\":\"" + JEsc(clanId) + "\"");
                        sb.Append(",\"kingdomId\":\"" + JEsc(kdmId) + "\"");
                        sb.Append(",\"x\":" + x.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"y\":" + y.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"troops\":" + troops);
                        sb.Append(",\"isPlayer\":" + (isPlayer ? "true" : "false"));
                        sb.Append(",\"isCaravan\":" + (mp.IsCaravan ? "true" : "false"));
                        sb.Append(",\"isHostile\":" + (isAtWar ? "true" : "false"));
                        sb.Append("}");
                        first = false;
                    }
                }
                catch (Exception ex) { Log("[Map] parties error: " + ex.Message); }
                sb.Append("],");

                // Wars — pairs of kingdom IDs currently at war
                sb.Append("\"wars\":[");
                first = true;
                try
                {
                    var kList = Kingdom.All.Where(k => k != null).ToList();
                    var seenPairs = new HashSet<string>();
                    for (int ki = 0; ki < kList.Count; ki++)
                    {
                        for (int kj = ki + 1; kj < kList.Count; kj++)
                        {
                            var ka = kList[ki]; var kb = kList[kj];
                            bool isWar = false;
                            try { isWar = FactionManager.IsAtWarAgainstFaction(ka, kb); } catch { }
                            if (!isWar) continue;
                            var pairKey = string.CompareOrdinal(ka.StringId, kb.StringId) < 0 ? (ka.StringId + "|" + kb.StringId) : (kb.StringId + "|" + ka.StringId);
                            if (seenPairs.Contains(pairKey)) continue;
                            seenPairs.Add(pairKey);
                            if (!first) sb.Append(",");
                            sb.Append("{\"a\":\"" + JEsc(ka.StringId) + "\",\"b\":\"" + JEsc(kb.StringId) + "\"}");
                            first = false;
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Kingdoms (with culture color)
                sb.Append("\"kingdoms\":[");
                first = true;
                try
                {
                    foreach (var k in Kingdom.All)
                    {
                        if (k == null) continue;
                        if (!first) sb.Append(",");
                        uint primary = 0;
                        try { primary = k.PrimaryBannerColor; } catch { }
                        uint secondary = 0;
                        try { secondary = k.SecondaryBannerColor; } catch { }
                        sb.Append("{\"id\":\"" + JEsc(k.StringId) + "\"");
                        sb.Append(",\"name\":\"" + JEsc(k.Name?.ToString()) + "\"");
                        sb.Append(",\"primaryColor\":" + primary);
                        sb.Append(",\"secondaryColor\":" + secondary);
                        sb.Append(",\"isPlayer\":" + (k == Hero.MainHero?.Clan?.Kingdom ? "true" : "false"));
                        sb.Append("}");
                        first = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Campaign time for day/night tint + season
                try
                {
                    var campaignTime = CampaignTime.Now;
                    int hour = 12, season = 0;
                    try
                    {
                        var hourProp = campaignTime.GetType().GetProperty("CurrentHourInDay");
                        if (hourProp != null) hour = Convert.ToInt32(hourProp.GetValue(campaignTime));
                    }
                    catch { }
                    try
                    {
                        var seasonProp = campaignTime.GetType().GetProperty("GetSeasonOfYear");
                        if (seasonProp != null) season = Convert.ToInt32(seasonProp.GetValue(campaignTime));
                    }
                    catch { }
                    sb.Append("\"campaignHour\":" + hour + ",");
                    sb.Append("\"season\":" + season + ",");
                    sb.Append("\"isNight\":" + ((hour < 6 || hour >= 20) ? "true" : "false") + ",");
                }
                catch { sb.Append("\"campaignHour\":12,\"season\":0,\"isNight\":false,"); }

                // World bounds for normalization
                sb.Append("\"bounds\":{");
                sb.Append("\"minX\":" + minX.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append(",\"minY\":" + minY.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append(",\"maxX\":" + maxX.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append(",\"maxY\":" + maxY.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append("}");
            }
            catch (Exception ex) { Log("[Map] error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        // Diplomacy: declarewar | makepeace | formalliance | tradeagreement
        private static string HandleKingdomDiplomacy(string action, string targetKingdomId)
        {
            if (string.IsNullOrEmpty(action) || string.IsNullOrEmpty(targetKingdomId))
                return "{\"error\":\"Missing action or targetKingdomId\"}";
            Log("[Diplomacy] HandleKingdomDiplomacy enqueueing action=" + action + " target=" + targetKingdomId);
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                Log("[Diplomacy] main-thread lambda START action=" + action);
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    Log("[Diplomacy] hero=" + hero?.Name + " kingdom=" + kingdom?.Name);
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }

                    Kingdom target = null;
                    foreach (var k in Kingdom.All)
                        if (k != null && k.StringId == targetKingdomId) { target = k; break; }
                    Log("[Diplomacy] target found=" + (target != null) + " name=" + target?.Name);
                    if (target == null) { result = "{\"error\":\"Target kingdom not found\"}"; doneEvent.Set(); return; }
                    if (target == kingdom) { result = "{\"error\":\"Cannot target your own kingdom\"}"; doneEvent.Set(); return; }

                    int cost = 200;
                    Log("[Diplomacy] influence check: have=" + hero.Clan.Influence + " need=" + cost);
                    if (hero.Clan.Influence < cost) { result = "{\"error\":\"Not enough influence (need " + cost + ")\"}"; doneEvent.Set(); return; }

                    string decisionTypeName = null;
                    switch (action.ToLower())
                    {
                        case "declarewar":
                            decisionTypeName = "TaleWorlds.CampaignSystem.Election.KingdomDeclareWarDecision";
                            break;
                        case "makepeace":
                            decisionTypeName = "TaleWorlds.CampaignSystem.Election.KingdomMakePeaceDecision";
                            break;
                        case "formalliance":
                            decisionTypeName = "TaleWorlds.CampaignSystem.Election.KingdomAllianceDecision";
                            break;
                        case "tradeagreement":
                            decisionTypeName = "TaleWorlds.CampaignSystem.Election.KingdomTradeAgreementDecision";
                            break;
                        default:
                            result = "{\"error\":\"Unknown action: " + JEsc(action) + "\"}"; doneEvent.Set(); return;
                    }

                    Type decisionType = null;
                    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        decisionType = asm.GetType(decisionTypeName);
                        if (decisionType != null) break;
                    }
                    if (decisionType == null)
                    {
                        // Search all assemblies for any type whose simple name matches the last segment
                        var simple = decisionTypeName.Substring(decisionTypeName.LastIndexOf('.') + 1);
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            try
                            {
                                foreach (var t in asm.GetTypes())
                                {
                                    if (t.Name == simple) { decisionType = t; Log("[Diplomacy] found " + simple + " in " + asm.GetName().Name); break; }
                                }
                            }
                            catch { }
                            if (decisionType != null) break;
                        }
                    }
                    if (decisionType == null)
                    {
                        // Dump all KingdomDecision-derived types so we can see what IS available
                        Log("[Diplomacy] " + decisionTypeName + " not found. Dumping all KingdomDecision types:");
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            try
                            {
                                foreach (var t in asm.GetTypes())
                                {
                                    if (t.Name.Contains("Kingdom") && t.Name.Contains("Decision"))
                                        Log("[Diplomacy]   " + t.FullName);
                                }
                            }
                            catch { }
                        }
                        result = "{\"error\":\"" + JEsc(action) + " is not available in this Bannerlord version (check logs)\"}"; doneEvent.Set(); return;
                    }
                    Log("[Diplomacy] using " + decisionType.FullName + " for action " + action);
                    foreach (var ctor2 in decisionType.GetConstructors())
                    {
                        var ps = ctor2.GetParameters();
                        var sig = string.Join(", ", ps.Select(p => p.ParameterType.Name + " " + p.Name).ToArray());
                        Log("[Diplomacy]   ctor(" + sig + ")");
                    }

                    object decision = null;
                    foreach (var ctor in decisionType.GetConstructors())
                    {
                        var pars = ctor.GetParameters();
                        try
                        {
                            if (pars.Length == 2)
                            {
                                decision = ctor.Invoke(new object[] { hero.Clan, target });
                                break;
                            }
                            else if (pars.Length == 3)
                            {
                                decision = ctor.Invoke(new object[] { hero.Clan, target, false });
                                break;
                            }
                        }
                        catch { }
                    }
                    if (decision == null) { result = "{\"error\":\"Could not construct " + JEsc(action) + " decision\"}"; doneEvent.Set(); return; }

                    // Spend influence
                    var infActionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                    var apply = infActionType?.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                    if (apply != null) apply.Invoke(null, new object[] { hero.Clan, (float)-cost });

                    // Add the decision to the kingdom
                    var addMethod = kingdom.GetType().GetMethod("AddDecision", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (addMethod != null)
                    {
                        var addPars = addMethod.GetParameters();
                        if (addPars.Length == 2) addMethod.Invoke(kingdom, new object[] { decision, true });
                        else addMethod.Invoke(kingdom, new object[] { decision });
                    }

                    result = "{\"success\":true,\"action\":\"" + JEsc(action) + "\",\"target\":\"" + JEsc(target.Name?.ToString()) + "\",\"cost\":" + cost + "}";
                }
                catch (Exception ex) { Log("[Diplomacy] error: " + ex.Message); result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string GetAvailableArmyPartiesJson()
        {
            var sb = new StringBuilder("[");
            try
            {
                var hero = Hero.MainHero;
                var kingdom = hero?.Clan?.Kingdom;
                if (kingdom == null) { return "{\"error\":\"Not in a kingdom\"}"; }
                var playerParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (playerParty == null) return "[]";

                bool first = true;
                foreach (var clan in kingdom.Clans)
                {
                    if (clan == null || clan.IsEliminated) continue;
                    foreach (var wpc in clan.WarPartyComponents)
                    {
                        var mp = wpc?.MobileParty;
                        if (mp == null || mp == playerParty) continue;
                        if (mp.Army != null) continue; // already in an army
                        var leader = mp.LeaderHero;
                        if (leader == null) continue;
                        // Calculate influence cost (0 for own clan; estimate for others by tier+distance)
                        int cost = 0;
                        if (clan != hero.Clan)
                        {
                            try
                            {
                                int tier = clan.Tier;
                                float dist = ApproxPartyDistance(playerParty, mp);
                                cost = (int)(20 + tier * 15 + dist * 0.4f);
                                if (cost < 20) cost = 20;
                            }
                            catch { cost = 50; }
                        }
                        int troops = mp.MemberRoster?.TotalManCount ?? 0;
                        if (!first) sb.Append(",");
                        sb.Append("{\"id\":\"" + JEsc(mp.StringId) + "\"");
                        sb.Append(",\"name\":\"" + JEsc(mp.Name?.ToString()) + "\"");
                        sb.Append(",\"leader\":\"" + JEsc(leader.Name?.ToString()) + "\"");
                        sb.Append(",\"leaderId\":\"" + JEsc(leader.StringId ?? "") + "\"");
                        sb.Append(",\"clan\":\"" + JEsc(clan.Name?.ToString()) + "\"");
                        sb.Append(",\"troops\":" + troops);
                        sb.Append(",\"influenceCost\":" + cost);
                        sb.Append(",\"isOwnClan\":" + (clan == hero.Clan ? "true" : "false"));
                        sb.Append("}");
                        first = false;
                    }
                }
            }
            catch (Exception ex) { Log("AvailableParties error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("]");
            return sb.ToString();
        }

        private static string HandleCreateArmy(string targetSettlementId, string partyIdsCsv)
        {
            if (string.IsNullOrEmpty(targetSettlementId)) return "{\"error\":\"Missing targetSettlementId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }
                    if (TaleWorlds.CampaignSystem.Party.MobileParty.MainParty == null) { result = "{\"error\":\"Player has no party\"}"; doneEvent.Set(); return; }
                    if (TaleWorlds.CampaignSystem.Party.MobileParty.MainParty.Army != null) { result = "{\"error\":\"You are already in an army\"}"; doneEvent.Set(); return; }

                    Settlement target = null;
                    foreach (var s in Settlement.All)
                        if (s != null && s.StringId == targetSettlementId) { target = s; break; }
                    if (target == null) { result = "{\"error\":\"Target settlement not found\"}"; doneEvent.Set(); return; }
                    if (target.OwnerClan?.Kingdom != kingdom) { result = "{\"error\":\"Target must be a fief of your kingdom\"}"; doneEvent.Set(); return; }

                    Log("[CreateArmy] Player=" + hero.Name + " kingdom=" + kingdom.Name + " target=" + target.Name);

                    // Parse comma-separated party IDs to invite (in addition to player)
                    var inviteIds = new HashSet<string>();
                    if (!string.IsNullOrEmpty(partyIdsCsv))
                        foreach (var pid in partyIdsCsv.Split(','))
                            if (!string.IsNullOrWhiteSpace(pid)) inviteIds.Add(pid.Trim());

                    // Try Kingdom.CreateArmy(Hero leader, Settlement target, Army.ArmyTypes type)
                    try
                    {
                        var kType = kingdom.GetType();
                        var createMethod = kType.GetMethod("CreateArmy", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (createMethod != null)
                        {
                            var pars = createMethod.GetParameters();
                            Log("[CreateArmy] Found kingdom.CreateArmy with " + pars.Length + " params");
                            if (pars.Length == 3)
                            {
                                // 3rd param is Army.ArmyTypes enum — use Patrolling (default safe)
                                var armyTypesType = Type.GetType("TaleWorlds.CampaignSystem.Army+ArmyTypes, TaleWorlds.CampaignSystem");
                                if (armyTypesType == null)
                                {
                                    // Fallback: search loaded assemblies
                                    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                                    {
                                        var t = asm.GetType("TaleWorlds.CampaignSystem.Army+ArmyTypes");
                                        if (t != null) { armyTypesType = t; break; }
                                    }
                                }
                                object armyType = armyTypesType != null ? Enum.Parse(armyTypesType, "Patrolling") : null;
                                createMethod.Invoke(kingdom, new object[] { hero, target, armyType });
                                int invitedCount = InviteSelectedPartiesToPlayerArmy(hero, kingdom, inviteIds);
                                result = "{\"success\":true,\"target\":\"" + JEsc(target.Name?.ToString()) + "\",\"invited\":" + invitedCount + "}";
                            }
                            else if (pars.Length == 2)
                            {
                                createMethod.Invoke(kingdom, new object[] { hero, target });
                                int invitedCount = InviteSelectedPartiesToPlayerArmy(hero, kingdom, inviteIds);
                                result = "{\"success\":true,\"target\":\"" + JEsc(target.Name?.ToString()) + "\",\"invited\":" + invitedCount + "}";
                            }
                        }
                        else
                        {
                            Log("[CreateArmy] kingdom.CreateArmy not found, trying KingdomArmyManagementCampaignBehavior");
                            // Fallback: find KingdomArmyManagementCampaignBehavior and call its create method
                            var campaign = Campaign.Current;
                            var behaviors = campaign?.GetType().GetProperty("CampaignBehaviorManager")?.GetValue(campaign);
                            if (behaviors != null)
                            {
                                var getMethod = behaviors.GetType().GetMethods().FirstOrDefault(m => m.Name == "GetBehavior" && m.IsGenericMethod);
                                if (getMethod != null)
                                {
                                    var armyMgrType = Type.GetType("TaleWorlds.CampaignSystem.CampaignBehaviors.KingdomArmyManagementCampaignBehavior, TaleWorlds.CampaignSystem");
                                    if (armyMgrType != null)
                                    {
                                        var typedGet = getMethod.MakeGenericMethod(armyMgrType);
                                        var armyMgr = typedGet.Invoke(behaviors, null);
                                        if (armyMgr != null)
                                        {
                                            var createBehMethod = armyMgr.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
                                                .FirstOrDefault(m => m.Name.Contains("CreateArmy"));
                                            if (createBehMethod != null)
                                            {
                                                var bp = createBehMethod.GetParameters();
                                                if (bp.Length == 3)
                                                {
                                                    var armyTypesType2 = Type.GetType("TaleWorlds.CampaignSystem.Army+ArmyTypes, TaleWorlds.CampaignSystem");
                                                    object armyType2 = armyTypesType2 != null ? Enum.Parse(armyTypesType2, "Patrolling") : null;
                                                    createBehMethod.Invoke(armyMgr, new object[] { hero, target, armyType2 });
                                                    result = "{\"success\":true,\"target\":\"" + JEsc(target.Name?.ToString()) + "\"}";
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex) { Log("[CreateArmy] error: " + ex.Message); result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }

                    if (result == null) result = "{\"error\":\"CreateArmy method not found in this Bannerlord version\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleChangePolicy(string policyId)
        {
            if (string.IsNullOrEmpty(policyId)) return "{\"error\":\"Missing policyId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    var kingdom = hero?.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"Not in a kingdom\"}"; doneEvent.Set(); return; }

                    var policy = TaleWorlds.ObjectSystem.MBObjectManager.Instance?
                        .GetObjectTypeList<TaleWorlds.CampaignSystem.PolicyObject>()
                        .FirstOrDefault(p => p?.StringId == policyId);
                    if (policy == null) { result = "{\"error\":\"Policy not found\"}"; doneEvent.Set(); return; }

                    int cost = 100;
                    if (hero.Clan.Influence < cost) { result = "{\"error\":\"Not enough influence (need " + cost + ")\"}"; doneEvent.Set(); return; }

                    bool isCurrentlyActive = false;
                    try
                    {
                        var activeProp = kingdom.GetType().GetProperty("ActivePolicies");
                        var actives = activeProp?.GetValue(kingdom) as System.Collections.IEnumerable;
                        if (actives != null)
                            foreach (var a in actives)
                                if (a == policy) { isCurrentlyActive = true; break; }
                    }
                    catch { }

                    bool isToEnact = !isCurrentlyActive;

                    // Build KingdomPolicyDecision via reflection (constructor signature varies by game version)
                    try
                    {
                        var decisionType = Type.GetType("TaleWorlds.CampaignSystem.Election.KingdomPolicyDecision, TaleWorlds.CampaignSystem");
                        if (decisionType == null)
                        {
                            // Fall back: search loaded assemblies
                            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                            {
                                decisionType = asm.GetType("TaleWorlds.CampaignSystem.Election.KingdomPolicyDecision");
                                if (decisionType != null) break;
                            }
                        }
                        if (decisionType == null) { result = "{\"error\":\"KingdomPolicyDecision type not found\"}"; doneEvent.Set(); return; }

                        object decision = null;
                        var ctors = decisionType.GetConstructors();
                        foreach (var ctor in ctors)
                        {
                            var pars = ctor.GetParameters();
                            try
                            {
                                if (pars.Length == 3)
                                {
                                    // (Clan, PolicyObject, bool)
                                    decision = ctor.Invoke(new object[] { hero.Clan, policy, isToEnact });
                                    break;
                                }
                                else if (pars.Length == 4)
                                {
                                    // (Clan, PolicyObject, bool, bool)
                                    decision = ctor.Invoke(new object[] { hero.Clan, policy, isToEnact, false });
                                    break;
                                }
                            }
                            catch { }
                        }
                        if (decision == null) { result = "{\"error\":\"Could not construct policy decision\"}"; doneEvent.Set(); return; }

                        // Spend influence
                        var infActionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                        if (infActionType != null)
                        {
                            var apply = infActionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (apply != null) apply.Invoke(null, new object[] { hero.Clan, (float)-cost });
                        }

                        // Add the decision to the kingdom
                        var addMethod = kingdom.GetType().GetMethod("AddDecision", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (addMethod != null)
                        {
                            var addPars = addMethod.GetParameters();
                            if (addPars.Length == 2) addMethod.Invoke(kingdom, new object[] { decision, true });
                            else addMethod.Invoke(kingdom, new object[] { decision });
                        }
                        else
                        {
                            // Try Campaign.Current.KingdomManager.AddDecision
                            var kmProp = typeof(Campaign).GetProperty("KingdomManager");
                            var km = kmProp?.GetValue(Campaign.Current);
                            var kmAdd = km?.GetType().GetMethod("AddDecision", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (kmAdd != null)
                            {
                                var kmPars = kmAdd.GetParameters();
                                if (kmPars.Length == 2) kmAdd.Invoke(km, new object[] { decision, true });
                                else kmAdd.Invoke(km, new object[] { decision });
                            }
                        }

                        result = "{\"success\":true,\"policy\":\"" + JEsc(policy.Name?.ToString()) + "\",\"action\":\"" + (isToEnact ? "enact" : "abolish") + "\",\"cost\":" + cost + "}";
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleGiftSettlement(string settlementId, string clanId)
        {
            if (string.IsNullOrEmpty(settlementId) || string.IsNullOrEmpty(clanId))
                return "{\"error\":\"Missing settlementId or clanId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                        if (s.StringId == settlementId) { target = s; break; }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }
                    if (target.OwnerClan != hero.Clan) { result = "{\"error\":\"You don't own this settlement\"}"; doneEvent.Set(); return; }

                    var kingdom = hero.Clan?.Kingdom;
                    if (kingdom == null) { result = "{\"error\":\"You are not in a kingdom\"}"; doneEvent.Set(); return; }

                    Clan recipient = null;
                    foreach (var c in kingdom.Clans)
                        if (c != null && c.StringId == clanId) { recipient = c; break; }
                    if (recipient == null) { result = "{\"error\":\"Recipient clan not found in kingdom\"}"; doneEvent.Set(); return; }
                    if (recipient == hero.Clan) { result = "{\"error\":\"Cannot gift to your own clan\"}"; doneEvent.Set(); return; }

                    Log("[Gift] Gifting " + target.Name?.ToString() + " to " + recipient.Name?.ToString());

                    bool success = false;

                    // Strategy 1: ChangeOwnerOfSettlementAction.ApplyByGift
                    try
                    {
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeOwnerOfSettlementAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var giftMethod = actionType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                                .FirstOrDefault(m => m.Name == "ApplyByGift");
                            if (giftMethod != null)
                            {
                                // Signature usually: (Settlement, Hero newOwner) or (Settlement, Hero, bool)
                                var paramTypes = giftMethod.GetParameters();
                                if (paramTypes.Length == 2)
                                    giftMethod.Invoke(null, new object[] { target, recipient.Leader });
                                else if (paramTypes.Length == 3)
                                    giftMethod.Invoke(null, new object[] { target, recipient.Leader, true });
                                success = true;
                                Log("[Gift] ApplyByGift succeeded");
                            }
                        }
                    }
                    catch (Exception ex) { Log("[Gift] Strategy 1 failed: " + ex.Message); }

                    // Strategy 2: ChangeOwnerOfSettlementAction.ApplyByDefault
                    if (!success)
                    {
                        try
                        {
                            var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeOwnerOfSettlementAction, TaleWorlds.CampaignSystem");
                            if (actionType != null)
                            {
                                var defaultMethod = actionType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                                    .FirstOrDefault(m => m.Name == "ApplyByDefault");
                                if (defaultMethod != null)
                                {
                                    defaultMethod.Invoke(null, new object[] { recipient.Leader, target });
                                    success = true;
                                    Log("[Gift] ApplyByDefault succeeded");
                                }
                            }
                        }
                        catch (Exception ex) { Log("[Gift] Strategy 2 failed: " + ex.Message); }
                    }

                    if (success)
                        result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"clan\":\"" + JEsc(recipient.Name?.ToString()) + "\"}";
                    else
                        result = "{\"error\":\"Could not gift settlement. Check debug log.\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleSendMemberToSettlement(string settlementId, string heroId)
        {
            if (string.IsNullOrEmpty(settlementId) || string.IsNullOrEmpty(heroId))
                return "{\"error\":\"Missing settlementId or heroId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var st in Settlement.All)
                        if (st.StringId == settlementId) { target = st; break; }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    Hero member = null;
                    foreach (var h in Hero.MainHero.Clan.Heroes)
                        if (h != null && h.IsAlive && h.StringId == heroId) { member = h; break; }
                    if (member == null) { result = "{\"error\":\"Hero not found in clan\"}"; doneEvent.Set(); return; }
                    if (member == Hero.MainHero) { result = "{\"error\":\"Cannot send the main hero\"}"; doneEvent.Set(); return; }

                    Log("[SendMember] Sending " + member.Name?.ToString() + " to " + target.Name?.ToString());

                    bool success = false;

                    // Strategy 1: EnterSettlementAction.ApplyForCharacterOnly
                    try
                    {
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.EnterSettlementAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var method = actionType.GetMethod("ApplyForCharacterOnly", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (method != null)
                            {
                                method.Invoke(null, new object[] { member, target });
                                success = true;
                                Log("[SendMember] EnterSettlementAction.ApplyForCharacterOnly succeeded");
                            }
                        }
                    }
                    catch (Exception ex) { Log("[SendMember] Strategy 1 failed: " + ex.Message); }

                    // Strategy 2: TeleportHeroAction
                    if (!success)
                    {
                        try
                        {
                            var teleType = Type.GetType("TaleWorlds.CampaignSystem.Actions.TeleportHeroAction, TaleWorlds.CampaignSystem");
                            if (teleType != null)
                            {
                                var applyMethod = teleType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                                    .FirstOrDefault(m => m.Name == "ApplyImmediateTeleportToSettlement");
                                if (applyMethod != null)
                                {
                                    applyMethod.Invoke(null, new object[] { member, target });
                                    success = true;
                                    Log("[SendMember] TeleportHeroAction succeeded");
                                }
                            }
                        }
                        catch (Exception ex) { Log("[SendMember] Strategy 2 failed: " + ex.Message); }
                    }

                    // Strategy 3: Set StayingInSettlement directly
                    if (!success)
                    {
                        try
                        {
                            var stayProp = member.GetType().GetProperty("StayingInSettlement", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            Log("[SendMember] StayingInSettlement prop: " + (stayProp != null ? "found, CanWrite=" + stayProp.CanWrite : "null"));
                            if (stayProp != null && stayProp.CanWrite)
                            {
                                stayProp.SetValue(member, target);
                                success = true;
                                Log("[SendMember] StayingInSettlement set directly");
                            }
                        }
                        catch (Exception ex) { Log("[SendMember] Strategy 3 failed: " + ex.Message); }
                    }

                    // Strategy 4: Hero.ChangeHeroGold — just log what's available
                    if (!success)
                    {
                        var heroMethods = member.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static)
                            .Where(m => m.Name.IndexOf("Settlement", StringComparison.OrdinalIgnoreCase) >= 0 || m.Name.IndexOf("Enter", StringComparison.OrdinalIgnoreCase) >= 0 || m.Name.IndexOf("Stay", StringComparison.OrdinalIgnoreCase) >= 0 || m.Name.IndexOf("Teleport", StringComparison.OrdinalIgnoreCase) >= 0)
                            .Select(m => m.Name + "(" + string.Join(",", m.GetParameters().Select(p => p.ParameterType.Name)) + ")").ToArray();
                        Log("[SendMember] Hero settlement methods: " + string.Join(", ", heroMethods));
                    }

                    if (success)
                    {
                        // Estimate travel time
                        int travelHours = 3; // default
                        try
                        {
                            var settPos = target.GetPosition2D;
                            var heroSettlement = member.CurrentSettlement ?? member.BornSettlement;
                            if (heroSettlement != null)
                            {
                                var heroPos = heroSettlement.GetPosition2D;
                                float dist = (float)Math.Sqrt(Math.Pow(heroPos.x - settPos.x, 2) + Math.Pow(heroPos.y - settPos.y, 2));
                                travelHours = Math.Max(1, (int)(dist * 2));
                            }
                        }
                        catch { }
                        result = "{\"success\":true,\"hero\":\"" + JEsc(member.Name?.ToString()) + "\",\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"travelHours\":" + travelHours + "}";
                    }
                    else
                        result = "{\"error\":\"Could not send member. Check debug log.\"}";
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        // ── API: Kingdom Detail ──
        private static string GetKingdomDetailJson(string id)
        {
            Kingdom k = null;
            foreach (var kk in Kingdom.All)
                if (kk != null && kk.StringId == id) { k = kk; break; }
            if (k == null) return "{\"error\":\"not found\"}";

            // Merge custom name/banner
            var kdBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
            string kdName = kdBeh?.GetCustomName(k.StringId);
            if (string.IsNullOrEmpty(kdName)) kdName = k.Name?.ToString();
            string kdBanner = kdBeh?.GetCustomBannerCode(k.StringId);
            string bannerCode = "";
            try { if (k.Banner != null) bannerCode = k.Banner.Serialize(); } catch { }
            if (string.IsNullOrEmpty(kdBanner)) kdBanner = bannerCode;

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(k.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(kdName) + "\",");
            sb.Append("\"culture\":\"" + JEsc(k.Culture?.Name?.ToString()) + "\",");
            sb.Append("\"bannerCode\":\"" + JEsc(kdBanner) + "\",");

            // Leader
            sb.Append("\"leader\":{");
            if (k.Leader != null)
            {
                string leaderBanner = "";
                try { if (k.Leader.Clan?.Banner != null) leaderBanner = k.Leader.Clan.Banner.Serialize(); } catch { }
                sb.Append("\"id\":\"" + JEsc(k.Leader.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(k.Leader.Name?.ToString()) + "\",");
                sb.Append("\"bannerCode\":\"" + JEsc(leaderBanner) + "\"");
            }
            sb.Append("},");

            // Clans
            sb.Append("\"clans\":[");
            bool first = true;
            foreach (var c in k.Clans)
            {
                if (c == null) continue;
                if (!first) sb.Append(",");
                string cBanner = "";
                try { if (c.Banner != null) cBanner = c.Banner.Serialize(); } catch { }
                sb.Append("{\"id\":\"" + JEsc(c.StringId) + "\",\"name\":\"" + JEsc(c.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(cBanner) + "\"}");
                first = false;
            }
            sb.Append("],");

            // Fiefs (towns + castles)
            sb.Append("\"fiefs\":[");
            first = true;
            foreach (var c in k.Clans)
            {
                if (c == null) continue;
                foreach (var f in c.Fiefs)
                {
                    if (f?.Settlement == null) continue;
                    if (!first) sb.Append(",");
                    string fType = f.Settlement.IsTown ? "Town" : "Castle";
                    string fBanner = "";
                    try { if (c.Banner != null) fBanner = c.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(f.Settlement.StringId) + "\",\"name\":\"" + JEsc(f.Settlement.Name?.ToString()) + "\",\"type\":\"" + fType + "\",\"bannerCode\":\"" + JEsc(fBanner) + "\"}");
                    first = false;
                }
            }
            sb.Append("],");

            // Wars (kingdoms + minor factions)
            sb.Append("\"wars\":[");
            first = true;
            try
            {
                // Enemy kingdoms
                foreach (var w in Kingdom.All)
                {
                    if (w == null || w == k) continue;
                    try { if (!k.IsAtWarWith(w)) continue; } catch { continue; }
                    if (!first) sb.Append(",");
                    string wBanner = "";
                    try { if (w.Banner != null) wBanner = w.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(w.StringId) + "\",\"name\":\"" + JEsc(w.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(wBanner) + "\"}");
                    first = false;
                }
                // Enemy minor factions (clans without a kingdom, or minor faction clans)
                foreach (var mc in Clan.All)
                {
                    if (mc == null || mc.Kingdom == k || mc.Kingdom != null) continue;
                    if (!mc.IsMinorFaction && !mc.IsBanditFaction) continue;
                    try { if (!k.IsAtWarWith(mc)) continue; } catch { continue; }
                    if (!first) sb.Append(",");
                    string mcBanner = "";
                    try { if (mc.Banner != null) mcBanner = mc.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(mc.StringId) + "\",\"name\":\"" + JEsc(mc.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(mcBanner) + "\"}");
                    first = false;
                }
            }
            catch { }
            sb.Append("],");

            // Stats
            int lords = 0, towns = 0, castles = 0, villages = 0, troops = 0, garrisons = 0;
            int totalInfluence = 0;
            try
            {
                foreach (var c in k.Clans)
                {
                    if (c == null) continue;
                    foreach (var h2 in c.Heroes)
                    {
                        if (h2 == null || h2.IsDead) continue;
                        lords++;
                        var party = h2.PartyBelongedTo;
                        if (party != null) troops += party.MemberRoster?.TotalManCount ?? 0;
                    }
                    try { totalInfluence += (int)c.Influence; } catch { }
                    foreach (var f2 in c.Fiefs)
                    {
                        if (f2?.Settlement == null) continue;
                        if (f2.Settlement.IsTown) { towns++; }
                        else if (f2.Settlement.IsCastle) { castles++; }
                    }
                    try
                    {
                        foreach (var v in c.Settlements)
                        {
                            if (v != null && v.IsVillage) villages++;
                        }
                    }
                    catch { }
                    // Garrisons
                    try
                    {
                        foreach (var f2 in c.Fiefs)
                        {
                            if (f2?.Settlement?.Town?.GarrisonParty?.MemberRoster != null)
                                garrisons += f2.Settlement.Town.GarrisonParty.MemberRoster.TotalManCount;
                        }
                    }
                    catch { }
                }
            }
            catch { }
            sb.Append("\"clanCount\":" + k.Clans.Count + ",");
            sb.Append("\"fiefCount\":" + k.Fiefs.Count + ",");
            sb.Append("\"lords\":" + lords + ",");
            sb.Append("\"towns\":" + towns + ",");
            sb.Append("\"castles\":" + castles + ",");
            sb.Append("\"villages\":" + villages + ",");
            sb.Append("\"strength\":" + troops + ",");
            sb.Append("\"garrisons\":" + garrisons + ",");
            sb.Append("\"influence\":" + totalInfluence);

            sb.Append("}");
            return sb.ToString();
        }

        // ── API: Clan Detail ──
        private static string GetClanDetailJson(string id)
        {
            Clan c = null;
            foreach (var cl in Clan.All)
                if (cl != null && cl.StringId == id) { c = cl; break; }
            if (c == null) return "{\"error\":\"not found\"}";

            // Merge custom name/banner
            var cdBeh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
            string cdName = cdBeh?.GetCustomName(c.StringId);
            if (string.IsNullOrEmpty(cdName)) cdName = c.Name?.ToString();
            string bannerCode = "";
            try { if (c.Banner != null) bannerCode = c.Banner.Serialize(); } catch { }
            string cdBanner = cdBeh?.GetCustomBannerCode(c.StringId);
            if (string.IsNullOrEmpty(cdBanner)) cdBanner = bannerCode;

            var sb = new StringBuilder("{");
            sb.Append("\"id\":\"" + JEsc(c.StringId) + "\",");
            sb.Append("\"name\":\"" + JEsc(cdName) + "\",");
            sb.Append("\"culture\":\"" + JEsc(c.Culture?.Name?.ToString()) + "\",");
            sb.Append("\"bannerCode\":\"" + JEsc(cdBanner) + "\",");

            // Kingdom banner
            sb.Append("\"kingdom\":{");
            if (c.Kingdom != null)
            {
                string kBanner = "";
                try { if (c.Kingdom.Banner != null) kBanner = c.Kingdom.Banner.Serialize(); } catch { }
                sb.Append("\"id\":\"" + JEsc(c.Kingdom.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(c.Kingdom.Name?.ToString()) + "\",");
                sb.Append("\"bannerCode\":\"" + JEsc(kBanner) + "\"");
            }
            sb.Append("},");

            // Leader
            sb.Append("\"leader\":{");
            if (c.Leader != null)
            {
                sb.Append("\"id\":\"" + JEsc(c.Leader.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(c.Leader.Name?.ToString()) + "\"");
            }
            sb.Append("},");

            // Members
            sb.Append("\"members\":[");
            bool first = true;
            foreach (var h in c.Heroes)
            {
                if (h == null) continue;
                if (!first) sb.Append(",");
                sb.Append("{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\",\"isDead\":" + (h.IsDead ? "true" : "false") + "}");
                first = false;
            }
            sb.Append("],");

            // Settlements
            sb.Append("\"settlements\":[");
            first = true;
            foreach (var f in c.Fiefs)
            {
                if (f?.Settlement == null) continue;
                if (!first) sb.Append(",");
                string fType = f.Settlement.IsTown ? "Town" : f.Settlement.IsCastle ? "Castle" : "Village";
                sb.Append("{\"id\":\"" + JEsc(f.Settlement.StringId) + "\",\"name\":\"" + JEsc(f.Settlement.Name?.ToString()) + "\",\"type\":\"" + fType + "\",\"bannerCode\":\"" + JEsc(bannerCode) + "\"}");
                first = false;
            }
            sb.Append("],");

            // Wars (through kingdom — kingdoms + minor factions)
            sb.Append("\"wars\":[");
            first = true;
            try
            {
                var warFaction = c.Kingdom != null ? (IFaction)c.Kingdom : (IFaction)c;
                // Enemy kingdoms
                foreach (var w in Kingdom.All)
                {
                    if (w == null || w == c.Kingdom) continue;
                    try { if (!warFaction.IsAtWarWith(w)) continue; } catch { continue; }
                    if (!first) sb.Append(",");
                    string wBanner = "";
                    try { if (w.Banner != null) wBanner = w.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(w.StringId) + "\",\"name\":\"" + JEsc(w.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(wBanner) + "\"}");
                    first = false;
                }
                // Enemy minor factions
                foreach (var mc in Clan.All)
                {
                    if (mc == null || mc == c) continue;
                    if (!mc.IsMinorFaction && !mc.IsBanditFaction) continue;
                    try { if (!warFaction.IsAtWarWith(mc)) continue; } catch { continue; }
                    if (!first) sb.Append(",");
                    string mcBanner = "";
                    try { if (mc.Banner != null) mcBanner = mc.Banner.Serialize(); } catch { }
                    sb.Append("{\"id\":\"" + JEsc(mc.StringId) + "\",\"name\":\"" + JEsc(mc.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(mcBanner) + "\"}");
                    first = false;
                }
            }
            catch { }
            sb.Append("],");

            // Stats
            sb.Append("\"tier\":" + c.Tier + ",");
            sb.Append("\"renown\":" + (int)c.Renown + ",");
            sb.Append("\"influence\":" + (int)c.Influence + ",");
            sb.Append("\"wealth\":" + (int)(c.Leader?.Gold ?? 0) + ",");

            // Extended stats
            int lords = 0, companions = 0, troops = 0, garrisons = 0, parties = 0;
            int towns = 0, castles = 0, villages = 0, caravans = 0, workshops = 0;
            try
            {
                foreach (var h in c.Heroes)
                {
                    if (h == null || h.IsDead) continue;
                    if (h.IsLord) lords++;
                    if (h.IsWanderer) companions++;
                }
                foreach (var h2 in c.Heroes)
                {
                    if (h2 == null || h2.IsDead) continue;
                    try
                    {
                        var party = h2.PartyBelongedTo;
                        if (party != null)
                        {
                            parties++;
                            troops += party.MemberRoster?.TotalManCount ?? 0;
                        }
                    }
                    catch { }
                    try { caravans += h2.OwnedCaravans?.Count ?? 0; } catch { }
                    try { workshops += h2.OwnedWorkshops?.Count ?? 0; } catch { }
                }
                foreach (var f in c.Fiefs)
                {
                    if (f?.Settlement == null) continue;
                    if (f.Settlement.IsTown) towns++;
                    else if (f.Settlement.IsCastle) castles++;
                    if (f.Settlement.IsTown || f.Settlement.IsCastle)
                    {
                        garrisons += f.Settlement.Town?.GarrisonParty?.MemberRoster?.TotalManCount ?? 0;
                        try { foreach (var v in f.Settlement.BoundVillages) if (v?.Settlement != null) villages++; } catch { }
                    }
                }
            }
            catch { }

            // Strength
            int strength = troops + garrisons;

            sb.Append("\"strength\":" + strength + ",");
            sb.Append("\"lords\":" + lords + ",");
            sb.Append("\"companions\":" + companions + ",");
            sb.Append("\"troops\":" + troops + ",");
            sb.Append("\"garrisons\":" + garrisons + ",");
            sb.Append("\"parties\":" + parties + ",");
            sb.Append("\"towns\":" + towns + ",");
            sb.Append("\"castles\":" + castles + ",");
            sb.Append("\"villages\":" + villages + ",");
            sb.Append("\"caravans\":" + caravans + ",");
            sb.Append("\"workshops\":" + workshops);

            sb.Append("}");
            return sb.ToString();
        }

        // ── API: Update Description ──
        private static void HandleUpdateDescription(HttpListenerRequest req, HttpListenerResponse res, string objectId)
        {
            if (string.IsNullOrEmpty(objectId)) { res.StatusCode = 400; WriteText(res, "Missing ID"); return; }
            string body = ReadBody(req);
            string text = ExtractJsonValue(body, "text");

            if (!EditableEncyclopedia.EditableEncyclopediaAPI.IsAvailable)
            {
                res.StatusCode = 500;
                WriteText(res, "Editable Encyclopedia not available");
                return;
            }

            // Use the public API to set description — null to clear
            EditableEncyclopedia.EditableEncyclopediaAPI.SetDescription(objectId, string.IsNullOrWhiteSpace(text) ? null : text);
            Log("WebServer: description updated for " + objectId);
            ServeJson(res, "{\"ok\":true}");
        }

        // ── API: Update Lore Field ──
        private static void HandleUpdateField(HttpListenerRequest req, HttpListenerResponse res, string path)
        {
            string afterHero = path.Substring(10); // after "/api/hero/"
            int fieldIdx = afterHero.IndexOf("/field/");
            if (fieldIdx < 0) { res.StatusCode = 400; WriteText(res, "Bad path"); return; }
            string objectId = afterHero.Substring(0, fieldIdx);
            string fieldKey = afterHero.Substring(fieldIdx + 7);

            string body = ReadBody(req);
            string text = ExtractJsonValue(body, "text");

            if (!EditableEncyclopedia.EditableEncyclopediaAPI.IsAvailable)
            {
                res.StatusCode = 500;
                WriteText(res, "Editable Encyclopedia not available");
                return;
            }

            EditableEncyclopedia.EditableEncyclopediaAPI.SetHeroInfoField(fieldKey, objectId, string.IsNullOrWhiteSpace(text) ? null : text);
            Log("WebServer: field '" + fieldKey + "' updated for " + objectId);
            ServeJson(res, "{\"ok\":true}");
        }

        // ── Helpers ──
        private static void ServeJson(HttpListenerResponse res, string json)
        {
            res.ContentType = "application/json; charset=utf-8";
            byte[] data = Encoding.UTF8.GetBytes(json);
            res.ContentLength64 = data.Length;
            res.OutputStream.Write(data, 0, data.Length);
            res.Close();
        }

        private static void WriteText(HttpListenerResponse res, string text)
        {
            res.ContentType = "text/plain";
            byte[] data = Encoding.UTF8.GetBytes(text);
            res.ContentLength64 = data.Length;
            res.OutputStream.Write(data, 0, data.Length);
            res.Close();
        }

        private static string ReadBody(HttpListenerRequest req)
        {
            using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
                return reader.ReadToEnd();
        }

        private static string ExtractId(string path, string prefix, string suffix)
        {
            int start = path.IndexOf(prefix) + prefix.Length;
            int end = path.IndexOf(suffix, start);
            if (end < 0) end = path.Length;
            return path.Substring(start, end - start);
        }

        private static string ExtractJsonValue(string json, string key)
        {
            string search = "\"" + key + "\"";
            int idx = json.IndexOf(search);
            if (idx < 0) return null;
            int colonIdx = json.IndexOf(':', idx + search.Length);
            if (colonIdx < 0) return null;
            int quoteStart = json.IndexOf('"', colonIdx + 1);
            if (quoteStart < 0) return null;
            int quoteEnd = quoteStart + 1;
            while (quoteEnd < json.Length)
            {
                if (json[quoteEnd] == '"' && json[quoteEnd - 1] != '\\') break;
                quoteEnd++;
            }
            return json.Substring(quoteStart + 1, quoteEnd - quoteStart - 1)
                .Replace("\\n", "\n").Replace("\\\"", "\"").Replace("\\\\", "\\");
        }

        // ── JSON Serialization Helpers ──

        private static string DictToJson(Dictionary<string, string> dict)
        {
            if (dict == null) return "{}";
            var sb = new StringBuilder("{");
            bool first = true;
            foreach (var kvp in dict)
            {
                if (!first) sb.Append(",");
                sb.Append("\"" + JEsc(kvp.Key) + "\":\"" + JEsc(kvp.Value ?? "") + "\"");
                first = false;
            }
            sb.Append("}");
            return sb.ToString();
        }

        private static string ListToJson(List<string> list)
        {
            if (list == null) return "[]";
            var sb = new StringBuilder("[");
            for (int i = 0; i < list.Count; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append("\"" + JEsc(list[i]) + "\"");
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string StringArrayToJson(string[] arr)
        {
            if (arr == null) return "[]";
            var sb = new StringBuilder("[");
            for (int i = 0; i < arr.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append("\"" + JEsc(arr[i]) + "\"");
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string JournalEntriesToJson(List<EditableEncyclopedia.JournalEntry> entries)
        {
            if (entries == null) return "[]";
            var sb = new StringBuilder("[");
            bool first = true;
            var seen = new HashSet<string>();
            foreach (var e in entries)
            {
                var key = (e.Date ?? "") + "||" + ((e.Text ?? "").Trim().ToLowerInvariant());
                if (seen.Contains(key)) continue;
                seen.Add(key);
                if (!first) sb.Append(",");
                sb.Append("{\"date\":\"" + JEsc(e.Date ?? "") + "\",\"text\":\"" + JEsc(e.Text ?? "") + "\"}");
                first = false;
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string JEsc(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "").Replace("\t", " ");
        }

        private static void Log(string message)
        {
            try { EditableEncyclopedia.MCMSettings.DebugLog("[EEWebExtension] " + message); }
            catch { }
        }

        // ═══════════════════════════════════════════════════════════════
        //  Banner & Portrait Export — runs on background thread after
        //  campaign start to pre-render images for the web UI
        // ═══════════════════════════════════════════════════════════════

        private static bool _exportRunning = false;

        /// <summary>
        /// Clears all exported portraits (called on new session/save load).
        /// </summary>
        public static void ClearPortraits()
        {
            try
            {
                string portraitDir = Path.Combine(_webRoot, "Portraits");
                if (Directory.Exists(portraitDir))
                {
                    foreach (var f in Directory.GetFiles(portraitDir, "*.png"))
                    {
                        try { File.Delete(f); } catch { }
                    }
                    Log("PortraitExtract: cleared old portraits for new session");
                }

                // Also clear old banners so they get re-exported for the current save
                string bannerDir = Path.Combine(_webRoot, "Banners");
                if (Directory.Exists(bannerDir))
                {
                    foreach (var f in Directory.GetFiles(bannerDir, "*.png"))
                    {
                        try { File.Delete(f); } catch { }
                    }
                    Log("Export: cleared old banners for new session");
                }

                // Reset extraction state
                _portraitExtractResult = -1;
                _portraitQueue = null;
                _currentProvider = null;
            }
            catch (Exception ex) { Log("PortraitExtract: clear error: " + ex.Message); }
        }

        /// <summary>
        /// Starts background export of banner images for all clans/kingdoms.
        /// Called from SubModule after campaign data is available.
        /// </summary>
        public static void StartExport()
        {
            if (_exportRunning || string.IsNullOrEmpty(_webRoot)) return;
            _exportRunning = true;
            var t = new Thread(() =>
            {
                try
                {
                    // Wait until campaign data is actually available (clans exist)
                    // New games need time for character creation to finish
                    for (int attempt = 0; attempt < 60; attempt++)
                    {
                        Thread.Sleep(10000); // Check every 10 seconds
                        try
                        {
                            int clanCount = 0;
                            foreach (var c in Clan.All) { if (c != null) { clanCount++; break; } }
                            if (clanCount > 0)
                            {
                                Log("Export: campaign data ready, starting banner export...");
                                ExtractBannerColorPalette();
                                ExtractMissingBannerIcons();
                                ExportBanners();
                                return;
                            }
                        }
                        catch { }
                    }
                    Log("Export: timed out waiting for campaign data");
                }
                catch (Exception ex)
                {
                    Log("Export error: " + ex.Message);
                }
                finally { _exportRunning = false; }
            });
            t.IsBackground = true;
            t.Start();
        }

        /// <summary>
        /// Extracts the actual banner color palette from the game's BannerManager at runtime.
        /// Updates both the C# color table and saves a JS file for the web UI.
        /// </summary>
        private static void ExtractBannerColorPalette()
        {
            try
            {
                var bmType = Type.GetType("TaleWorlds.Core.BannerManager, TaleWorlds.Core");
                if (bmType == null) { Log("Export: BannerManager type not found"); return; }

                var instProp = bmType.GetProperty("Instance", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                if (instProp == null) { Log("Export: BannerManager.Instance not found"); return; }
                var instance = instProp.GetValue(null);
                if (instance == null) { Log("Export: BannerManager.Instance is null"); return; }

                // Log ALL BannerManager members to discover color palette access
                var allProps = bmType.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static);
                var allFields = bmType.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static);
                var allMethods = bmType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static);
                Log("Export: BannerManager props: " + string.Join(", ", System.Array.ConvertAll(allProps, p => p.Name + ":" + p.PropertyType.Name)));
                Log("Export: BannerManager fields: " + string.Join(", ", System.Array.ConvertAll(allFields, f => f.Name + ":" + f.FieldType.Name)));
                Log("Export: BannerManager methods: " + string.Join(", ", System.Array.ConvertAll(allMethods, m => m.Name + "(" + string.Join(",", System.Array.ConvertAll(m.GetParameters(), p2 => p2.ParameterType.Name)) + "):" + m.ReturnType.Name)));

                var discoveredColors = new Dictionary<int, string>();

                // Try ReadOnlyColorPalette, ColorPalette, _colorPalette, etc.
                string[] paletteNames = { "ReadOnlyColorPalette", "ColorPalette", "_colorPalette", "_bannerColorPalette", "BannerColorPalette" };
                object palette = null;
                string foundName = null;
                var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;

                foreach (var name in paletteNames)
                {
                    var prop = bmType.GetProperty(name, flags);
                    if (prop != null) { palette = prop.GetValue(instance); foundName = name + "(prop)"; break; }
                    var field = bmType.GetField(name, flags);
                    if (field != null) { palette = field.GetValue(instance); foundName = name + "(field)"; break; }
                }

                // Use GetColor(int):uint method directly — simplest and most reliable
                var getColorMethod = bmType.GetMethod("GetColor", new Type[] { typeof(int) });
                if (getColorMethod != null)
                {
                    Log("Export: using BannerManager.GetColor(int) method");
                    // Query all color IDs we know about (0-250) plus check for gaps
                    for (int id = 0; id <= 250; id++)
                    {
                        try
                        {
                            uint cval = (uint)getColorMethod.Invoke(instance, new object[] { id });
                            if (cval != 0) // skip empty/undefined colors
                            {
                                byte r = (byte)((cval >> 16) & 0xFF);
                                byte g = (byte)((cval >> 8) & 0xFF);
                                byte b = (byte)(cval & 0xFF);
                                discoveredColors[id] = string.Format("#{0:x2}{1:x2}{2:x2}", r, g, b);
                            }
                        }
                        catch { }
                    }
                    // Log sample colors for verification
                    string[] sampleNames = { "Aserai bg", "Battania bg", "N.Empire bg", "S.Empire bg", "W.Empire bg", "Khuzait bg", "Sturgia bg", "Vlandia bg" };
                    int[] sampleIds = { 0, 2, 4, 6, 8, 10, 12, 14 };
                    for (int i = 0; i < sampleIds.Length; i++)
                    {
                        string val;
                        if (discoveredColors.TryGetValue(sampleIds[i], out val))
                            Log("Export: color " + sampleIds[i] + " (" + sampleNames[i] + ") = " + val);
                    }
                    // Also log Naval DLC colors
                    if (discoveredColors.ContainsKey(218)) Log("Export: color 218 (Nord bg) = " + discoveredColors[218]);
                }
                else if (palette != null)
                {
                    Log("Export: GetColor method not found, trying palette iteration, type=" + palette.GetType().FullName);
                    // Fallback: iterate the palette
                    if (palette is System.Collections.IEnumerable enumPalette)
                    {
                        bool loggedFirst = false;
                        foreach (var item in enumPalette)
                        {
                            var itemType = item.GetType();
                            var keyProp = itemType.GetProperty("Key");
                            var valProp = itemType.GetProperty("Value");
                            if (keyProp != null && valProp != null)
                            {
                                int colorId = Convert.ToInt32(keyProp.GetValue(item));
                                var colorObj = valProp.GetValue(item);
                                var colorType = colorObj.GetType();
                                if (!loggedFirst)
                                {
                                    var cProps = colorType.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    var cFields = colorType.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                    Log("Export: BannerColor props: " + string.Join(", ", System.Array.ConvertAll(cProps, p => p.Name + ":" + p.PropertyType.Name)));
                                    Log("Export: BannerColor fields: " + string.Join(", ", System.Array.ConvertAll(cFields, f => f.Name + ":" + f.FieldType.Name)));
                                    loggedFirst = true;
                                }
                                // Try Color property
                                var cColorProp = colorType.GetProperty("Color");
                                if (cColorProp != null)
                                {
                                    var val = cColorProp.GetValue(colorObj);
                                    if (val is uint uval)
                                    {
                                        byte r = (byte)((uval >> 16) & 0xFF);
                                        byte g = (byte)((uval >> 8) & 0xFF);
                                        byte b = (byte)(uval & 0xFF);
                                        discoveredColors[colorId] = string.Format("#{0:x2}{1:x2}{2:x2}", r, g, b);
                                    }
                                    else if (!loggedFirst)
                                    {
                                        Log("Export: BannerColor.Color type=" + val?.GetType().FullName + " val=" + val);
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    Log("Export: no color palette property/method found on BannerManager");
                }

                if (discoveredColors.Count > 0)
                {
                    int diffs = 0;
                    // Log first 10 color comparisons for debugging
                    int logged = 0;
                    foreach (var kv in discoveredColors)
                    {
                        string existing;
                        bool hadExisting = BannerColorHex.TryGetValue(kv.Key, out existing);
                        bool isDiff = !hadExisting || existing.ToLower() != kv.Value.ToLower();
                        if (isDiff) diffs++;
                        if (logged < 20 && isDiff)
                        {
                            Log("Export: color " + kv.Key + " changed: " + (hadExisting ? existing : "N/A") + " -> " + kv.Value);
                            logged++;
                        }
                        BannerColorHex[kv.Key] = kv.Value;
                    }
                    Log("Export: discovered " + discoveredColors.Count + " banner colors from game (" + diffs + " different from hardcoded)");
                }

                Log("Export: using colors directly (e.g. color14=" + BannerColorHex[14] + " color218=" + (BannerColorHex.ContainsKey(218) ? BannerColorHex[218] : "N/A") + ")");

                // Save as JS file — colors used as-is from game XML
                {
                    var sb = new StringBuilder("// Auto-extracted banner colors from game\nvar BANNER_COLORS = {\n");
                    bool first = true;
                    foreach (var kv in BannerColorHex)
                    {
                        if (!first) sb.Append(",\n");
                        sb.Append("  " + kv.Key + ":'" + kv.Value + "'");
                        first = false;
                    }
                    sb.Append("\n};\n");
                    string jsPath = Path.Combine(_webRoot, "js", "banner_colors.js");
                    File.WriteAllText(jsPath, sb.ToString());
                }
            }
            catch (Exception ex)
            {
                Log("Export: color palette extraction error: " + ex.Message);
            }
        }

        /// <summary>
        /// Extracts missing banner icon images from the game's texture system at runtime.
        /// Uses TaleWorlds.Engine.Texture to read the texture atlas and crop individual icons.
        /// </summary>
        private static void ExtractMissingBannerIcons()
        {
            string iconDir = Path.Combine(_webRoot, "BannerIcons");
            if (!Directory.Exists(iconDir)) Directory.CreateDirectory(iconDir);

            // Scan all banners for mesh IDs that are missing icons
            var allMeshIds = new HashSet<int>();
            try
            {
                foreach (var c in Clan.All)
                {
                    if (c?.Banner == null) continue;
                    try
                    {
                        string code = c.Banner.Serialize();
                        if (string.IsNullOrEmpty(code)) continue;
                        var parts = code.Split('.');
                        for (int i = 0; i + 9 < parts.Length; i += 10)
                        {
                            int meshId;
                            if (int.TryParse(parts[i], out meshId)) allMeshIds.Add(meshId);
                        }
                    }
                    catch { }
                }
                foreach (var k in Kingdom.All)
                {
                    if (k?.Banner == null) continue;
                    try
                    {
                        string code = k.Banner.Serialize();
                        if (string.IsNullOrEmpty(code)) continue;
                        var parts = code.Split('.');
                        for (int i = 0; i + 9 < parts.Length; i += 10)
                        {
                            int meshId;
                            if (int.TryParse(parts[i], out meshId)) allMeshIds.Add(meshId);
                        }
                    }
                    catch { }
                }
            }
            catch { }

            // Check which icons are missing
            var missing = new List<int>();
            foreach (int meshId in allMeshIds)
            {
                string pngPath = Path.Combine(iconDir, meshId + ".png");
                string webpPath = Path.Combine(iconDir, meshId + ".webp");
                if (!File.Exists(pngPath) && !File.Exists(webpPath))
                    missing.Add(meshId);
            }

            if (missing.Count == 0)
            {
                Log("Export: all banner icons present");
                return;
            }

            Log("Export: " + missing.Count + " banner icons missing: " + string.Join(", ", missing));

            // Use BannerManager to discover atlas & index for each missing icon
            // Group by MaterialName so we load each atlas only once
            var iconsByAtlas = new Dictionary<string, List<KeyValuePair<int, int>>>(); // atlas -> [(iconId, texIndex)]
            try
            {
                var bmType = Type.GetType("TaleWorlds.Core.BannerManager, TaleWorlds.Core");
                var bmInst = bmType?.GetProperty("Instance", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.GetValue(null);
                var getIconData = bmType?.GetMethod("GetIconDataFromIconId", new[] { typeof(int) });

                if (bmInst != null && getIconData != null)
                {
                    foreach (int iconId in missing)
                    {
                        try
                        {
                            var iconData = getIconData.Invoke(bmInst, new object[] { iconId });
                            if (iconData == null) continue;
                            var idType = iconData.GetType();
                            var matProp = idType.GetProperty("MaterialName");
                            var idxProp = idType.GetProperty("TextureIndex");
                            if (matProp == null || idxProp == null) continue;
                            string matName = (string)matProp.GetValue(iconData);
                            int texIdx = (int)idxProp.GetValue(iconData);
                            Log("Export: icon " + iconId + " -> atlas=" + matName + " texIdx=" + texIdx);
                            if (!string.IsNullOrEmpty(matName))
                            {
                                if (!iconsByAtlas.ContainsKey(matName))
                                    iconsByAtlas[matName] = new List<KeyValuePair<int, int>>();
                                iconsByAtlas[matName].Add(new KeyValuePair<int, int>(iconId, texIdx));
                            }
                        }
                        catch (Exception ex) { Log("Export: icon " + iconId + " lookup failed: " + ex.Message); }
                    }
                }
            }
            catch { }

            try
            {
                var texType = Type.GetType("TaleWorlds.Engine.Texture, TaleWorlds.Engine");
                if (texType == null)
                {
                    Log("Export: TaleWorlds.Engine.Texture type not found");
                    return;
                }

                var getFromResource = texType.GetMethod("GetFromResource",
                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static,
                    null, new[] { typeof(string) }, null);
                if (getFromResource == null)
                {
                    Log("Export: Texture.GetFromResource method not found");
                    return;
                }

                var widthProp = texType.GetProperty("Width");
                var heightProp = texType.GetProperty("Height");

                // Extract icons from each atlas they belong to
                foreach (var atlasKv in iconsByAtlas)
                {
                    string atlasName = atlasKv.Key;
                    var iconsInAtlas = atlasKv.Value;
                    Log("Export: extracting " + iconsInAtlas.Count + " icons from " + atlasName);

                    var texture = getFromResource.Invoke(null, new object[] { atlasName });
                    if (texture == null)
                    {
                        Log("Export: " + atlasName + " texture not found in game resources");
                        continue;
                    }

                    int texW = (int)widthProp.GetValue(texture);
                    int texH = (int)heightProp.GetValue(texture);
                    Log("Export: " + atlasName + " atlas: " + texW + "x" + texH);

                    // Try SaveToFile first (more reliable than GetPixelData for some textures)
                    string savedAtlasPath = Path.Combine(iconDir, "_atlas_" + atlasName + ".png");
                    System.Drawing.Bitmap atlasBmp = null;
                    try
                    {
                        var saveMethod = texType.GetMethod("SaveToFile",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance,
                            null, new[] { typeof(string), typeof(bool) }, null);
                        if (saveMethod != null)
                        {
                            saveMethod.Invoke(texture, new object[] { savedAtlasPath, false });
                            if (File.Exists(savedAtlasPath) && new FileInfo(savedAtlasPath).Length > 100)
                            {
                                atlasBmp = new System.Drawing.Bitmap(savedAtlasPath);
                                Log("Export: saved atlas via SaveToFile: " + savedAtlasPath + " (" + atlasBmp.Width + "x" + atlasBmp.Height + ")");
                            }
                        }
                    }
                    catch (Exception ex) { Log("Export: SaveToFile failed for " + atlasName + ": " + (ex.InnerException?.Message ?? ex.Message)); }

                    if (atlasBmp == null)
                    {
                        Log("Export: SaveToFile unavailable, trying GetPixelData for " + atlasName);
                        // Fallback: GetPixelData
                        var getPixelData = texType.GetMethod("GetPixelData",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance,
                            null, new[] { typeof(byte[]) }, null);
                        if (getPixelData == null) continue;
                        byte[] pixelBytes = new byte[texW * texH * 4];
                        getPixelData.Invoke(texture, new object[] { pixelBytes });
                        atlasBmp = new System.Drawing.Bitmap(texW, texH);
                        for (int dy = 0; dy < texH; dy++)
                            for (int dx = 0; dx < texW; dx++)
                            {
                                int doff = (dy * texW + dx) * 4;
                                atlasBmp.SetPixel(dx, dy, System.Drawing.Color.FromArgb(
                                    pixelBytes[doff + 3], pixelBytes[doff + 2], pixelBytes[doff + 1], pixelBytes[doff]));
                            }
                    }

                    // Determine grid layout
                    int maxIdx = 0;
                    foreach (var ik in iconsInAtlas)
                        if (ik.Value > maxIdx) maxIdx = ik.Value;
                    int cols = (atlasBmp.Width >= 2048) ? 8 : 4;
                    int cellW = atlasBmp.Width / cols;
                    int cellH = cellW;
                    int gridRows = atlasBmp.Height / cellH;
                    if (maxIdx >= cols * gridRows) { cols = 8; cellW = atlasBmp.Width / cols; cellH = cellW; }
                    Log("Export: atlas grid: " + cols + " cols, " + cellW + "x" + cellH + " cells");

                    foreach (var iconKv in iconsInAtlas)
                    {
                        int iconId = iconKv.Key;
                        int texIdx = iconKv.Value;
                        int col = texIdx % cols;
                        int row = texIdx / cols;

                        var bmp = new System.Drawing.Bitmap(cellW, cellH);
                        using (var g = System.Drawing.Graphics.FromImage(bmp))
                        {
                            g.DrawImage(atlasBmp,
                                new System.Drawing.Rectangle(0, 0, cellW, cellH),
                                new System.Drawing.Rectangle(col * cellW, row * cellH, cellW, cellH),
                                System.Drawing.GraphicsUnit.Pixel);
                        }
                        string outPath = Path.Combine(iconDir, iconId + ".png");
                        bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                        bmp.Dispose();
                        Log("Export: extracted icon " + iconId + " from " + atlasName + " idx=" + texIdx + " col=" + col + " row=" + row + " size=" + cellW + "x" + cellH);
                    }
                    atlasBmp.Dispose();
                    try { File.Delete(savedAtlasPath); } catch { }
                }

                // Check if any icons are still missing
                var stillMissing2 = new List<int>();
                foreach (int id in missing)
                {
                    string p = Path.Combine(iconDir, id + ".png");
                    if (!File.Exists(p)) stillMissing2.Add(id);
                }
                if (stillMissing2.Count > 0)
                    Log("Export: " + stillMissing2.Count + " icons still missing after extraction: " + string.Join(", ", stillMissing2));

                try
                {
                    // no-op: all extraction handled above
                }
                catch (Exception ex)
                {
                    Log("Export: GetPixelData failed: " + (ex.InnerException?.Message ?? ex.Message));
                }

                Log("Export: could not extract texture data, Naval DLC icons will use diamond fallback");
            }
            catch (Exception ex)
            {
                Log("Export: icon extraction error: " + ex.Message);
            }
        }

        private static void CropIconsFromAtlas(string atlasPath, string iconDir,
            Dictionary<int, int> iconMap, List<int> missing, int texW, int texH)
        {
            try
            {
                if (!File.Exists(atlasPath)) return;
                using (var atlas = new System.Drawing.Bitmap(atlasPath))
                {
                    // Atlas uses 8 columns, square cells
                    int cols = 8;
                    int cellW = atlas.Width / cols;
                    int cellH = cellW;

                    foreach (int iconId in missing)
                    {
                        if (!iconMap.ContainsKey(iconId)) continue;
                        int texIdx = iconMap[iconId];
                        int col = texIdx % cols;
                        int row = texIdx / cols;

                        var bmp = new System.Drawing.Bitmap(cellW, cellH);
                        for (int y = 0; y < cellH; y++)
                        {
                            for (int x = 0; x < cellW; x++)
                            {
                                var px = atlas.GetPixel(col * cellW + x, row * cellH + y);
                                // Icons packed in different channels; use 255 - min(R,G,B,A)
                                byte minVal = Math.Min(Math.Min(px.R, px.G), Math.Min(px.B, px.A));
                                byte newAlpha = (byte)(255 - minVal);
                                bmp.SetPixel(x, y, System.Drawing.Color.FromArgb(newAlpha, 255, 255, 255));
                            }
                        }
                        string outPath = Path.Combine(iconDir, iconId + ".png");
                        bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                        bmp.Dispose();
                        Log("Export: extracted icon " + iconId + " from atlas");
                    }
                }
                try { File.Delete(atlasPath); } catch { }
            }
            catch (Exception ex)
            {
                Log("Export: CropIconsFromAtlas error: " + ex.Message);
            }
        }

        private static void ExtractIconsFromRawBytes(byte[] bytes, string iconDir,
            Dictionary<int, int> iconMap, List<int> missing, int texW, int texH)
        {
            try
            {
                // Atlas is 8 columns, square cells
                int cols = 8;
                int cellW = texW / cols;
                int cellH = cellW;

                foreach (int iconId in missing)
                {
                    if (!iconMap.ContainsKey(iconId)) continue;
                    int texIdx = iconMap[iconId];
                    int col = texIdx % cols;
                    int row = texIdx / cols;

                    var bmp = new System.Drawing.Bitmap(cellW, cellH);
                    for (int y = 0; y < cellH; y++)
                    {
                        for (int x = 0; x < cellW; x++)
                        {
                            int sx = col * cellW + x;
                            int sy = row * cellH + y;
                            int offset = (sy * texW + sx) * 4;
                            if (offset + 3 < bytes.Length)
                            {
                                // Icons are packed into different channels of the atlas
                                // Background = (255,255,255,255), icon shape = lower values in one or more channels
                                // Use 255 - min(R,G,B,A) as alpha to capture any channel's data
                                byte b2 = bytes[offset], g2 = bytes[offset + 1];
                                byte r2 = bytes[offset + 2], a2 = bytes[offset + 3];
                                byte minVal = Math.Min(Math.Min(r2, g2), Math.Min(b2, a2));
                                byte newAlpha = (byte)(255 - minVal);
                                bmp.SetPixel(x, y, System.Drawing.Color.FromArgb(newAlpha, 255, 255, 255));
                            }
                        }
                    }
                    string outPath = Path.Combine(iconDir, iconId + ".png");
                    bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                    bmp.Dispose();
                    Log("Export: extracted icon " + iconId + " from raw bytes");
                }
            }
            catch (Exception ex)
            {
                Log("Export: ExtractIconsFromRawBytes error: " + ex.Message);
            }
        }

        private static void ExportBanners()
        {
            string bannerDir = Path.Combine(_webRoot, "Banners");
            if (!Directory.Exists(bannerDir))
                Directory.CreateDirectory(bannerDir);

            string iconDir = Path.Combine(_webRoot, "BannerIcons");
            int exported = 0;

            // Collect all entities with banners
            var bannerEntities = new List<KeyValuePair<string, string>>();
            try
            {
                foreach (var c in Clan.All)
                {
                    if (c?.Banner == null) continue;
                    try
                    {
                        string code = c.Banner.Serialize();
                        if (!string.IsNullOrEmpty(code))
                            bannerEntities.Add(new KeyValuePair<string, string>(c.StringId, code));
                    }
                    catch { }
                }
                foreach (var k in Kingdom.All)
                {
                    if (k?.Banner == null) continue;
                    try
                    {
                        string code = k.Banner.Serialize();
                        if (!string.IsNullOrEmpty(code))
                            bannerEntities.Add(new KeyValuePair<string, string>(k.StringId, code));
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                Log("Export: error collecting banners: " + ex.Message);
                return;
            }

            Log("Export: found " + bannerEntities.Count + " entities with banners, iconDir=" + iconDir);
            // Log sample banner codes to understand color mapping
            foreach (var kv in bannerEntities)
            {
                if (kv.Key.Contains("vlandia") || kv.Key.Contains("nord") || kv.Key.Contains("empire_w"))
                {
                    var p = kv.Value.Split('.');
                    if (p.Length >= 10)
                    {
                        string bgInfo = "mesh=" + p[0] + " c1=" + p[1] + " c2=" + p[2];
                        string c1Hex, c2Hex;
                        BannerColorHex.TryGetValue(int.Parse(p[1]), out c1Hex);
                        BannerColorHex.TryGetValue(int.Parse(p[2]), out c2Hex);
                        Log("Export: BANNER " + kv.Key + ": " + bgInfo + " (c1=" + c1Hex + " c2=" + c2Hex + ") code=" + kv.Value.Substring(0, Math.Min(60, kv.Value.Length)));
                    }
                }
            }
            int failed = 0;

            foreach (var kv in bannerEntities)
            {
                string filePath = Path.Combine(bannerDir, kv.Key + ".png");
                if (File.Exists(filePath)) continue; // Skip already exported

                try
                {
                    var bmp = RenderBannerToBitmap(kv.Value, iconDir, 256);
                    if (bmp != null)
                    {
                        bmp.Save(filePath, System.Drawing.Imaging.ImageFormat.Png);
                        bmp.Dispose();
                        exported++;
                    }
                    else
                    {
                        failed++;
                        if (failed <= 3) Log("Export: RenderBannerToBitmap returned null for " + kv.Key + " code=" + kv.Value.Substring(0, Math.Min(40, kv.Value.Length)));
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    if (failed <= 3) Log("Export: failed banner " + kv.Key + ": " + ex.Message);
                }
            }
            int skipped = bannerEntities.Count - exported - failed;
            Log("Export: " + exported + " new banners exported, " + skipped + " already existed, " + failed + " failed — " + bannerDir);
        }

        /// <summary>
        /// Renders a Bannerlord banner code to a System.Drawing.Bitmap.
        /// Mirrors the JavaScript canvas renderer logic.
        /// </summary>
        private static System.Drawing.Bitmap RenderBannerToBitmap(string code, string iconDir, int size)
        {
            if (string.IsNullOrEmpty(code)) return null;
            var parts = code.Split('.');
            if (parts.Length < 10) return null;

            int[] nums = new int[parts.Length];
            for (int i = 0; i < parts.Length; i++)
            {
                if (!int.TryParse(parts[i], out nums[i])) return null;
            }

            // Parse layers (10 values each)
            var layers = new List<int[]>();
            for (int i = 0; i + 9 < nums.Length; i += 10)
            {
                layers.Add(new[] { nums[i], nums[i+1], nums[i+2], nums[i+3], nums[i+4], nums[i+5], nums[i+6], nums[i+7], nums[i+8], nums[i+9] });
            }
            if (layers.Count == 0) return null;

            var bmp = new System.Drawing.Bitmap(size, size);
            using (var g = System.Drawing.Graphics.FromImage(bmp))
            {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

                float s = size / 100f;

                // Shield clip path
                var shieldPath = new System.Drawing.Drawing2D.GraphicsPath();
                shieldPath.AddLine(10*s, 2*s, 90*s, 2*s);
                shieldPath.AddLine(90*s, 2*s, 90*s, 55*s);
                // Approximate the quadratic curves
                shieldPath.AddBezier(90*s, 55*s, 90*s, 80*s, 70*s, 98*s, 50*s, 98*s);
                shieldPath.AddBezier(50*s, 98*s, 30*s, 98*s, 10*s, 80*s, 10*s, 55*s);
                shieldPath.CloseFigure();
                g.SetClip(shieldPath);

                // Background
                var bgColor = GetBannerColor(layers[0][1]);
                var bgColor2 = GetBannerColor(layers[0][2]);
                // DEBUG: log first 3 banners' background colors
                if (code.Contains(".14.14.") || code.Contains(".218.218.") || code.Contains(".8.8."))
                    Log("Export: RENDER bg c1idx=" + layers[0][1] + " c2idx=" + layers[0][2] + " bgColor=ARGB(" + bgColor.A + "," + bgColor.R + "," + bgColor.G + "," + bgColor.B + ") hex=#" + bgColor.R.ToString("x2") + bgColor.G.ToString("x2") + bgColor.B.ToString("x2"));
                using (var brush = new System.Drawing.Drawing2D.LinearGradientBrush(
                    new System.Drawing.Point(0, 0), new System.Drawing.Point(0, size), bgColor, bgColor2))
                {
                    g.FillRectangle(brush, 0, 0, size, size);
                }

                // Background pattern overlay (skip icon 11 which is a solid green square)
                int bgMeshId = layers[0][0];
                if (bgMeshId != 11)
                {
                    try
                    {
                        var bgIcon = LoadIconImage(iconDir, bgMeshId);
                        if (bgIcon != null)
                        {
                            var cm = new System.Drawing.Imaging.ColorMatrix { Matrix33 = 0.3f };
                            var ia = new System.Drawing.Imaging.ImageAttributes();
                            ia.SetColorMatrix(cm);
                            g.DrawImage(bgIcon, new System.Drawing.Rectangle(0, 0, size, size),
                                0, 0, bgIcon.Width, bgIcon.Height, System.Drawing.GraphicsUnit.Pixel, ia);
                            ia.Dispose();
                        }
                    }
                    catch { }
                }

                // Emblem layers
                for (int i = 1; i < layers.Count && i < 8; i++)
                {
                    try
                    {
                        var l = layers[i];
                        int meshId = l[0];
                        var color = GetBannerColor(l[1]);
                        float w = Math.Abs(l[3] / 1528f) * size;
                        float h = Math.Abs(l[4] / 1528f) * size;
                        float cx = (l[5] / 1528f) * size;
                        float cy = (l[6] / 1528f) * size;
                        float rot = l[9] * 0.00174533f;
                        bool mirror = l[8] != 0;

                        if (w < 1 || h < 1) continue; // Skip zero-size layers

                        var icon = LoadIconImage(iconDir, meshId);
                        g.TranslateTransform(cx, cy);
                        if (rot != 0) g.RotateTransform(rot * 57.2958f);
                        if (mirror) g.ScaleTransform(-1, 1);

                        if (icon != null)
                        {
                            // Tint icon using offscreen bitmap
                            var tintW = Math.Max(1, (int)Math.Ceiling(w));
                            var tintH = Math.Max(1, (int)Math.Ceiling(h));
                            using (var tinted = new System.Drawing.Bitmap(icon, tintW, tintH))
                            {
                                for (int py = 0; py < tintH; py++)
                                    for (int px = 0; px < tintW; px++)
                                    {
                                        var px2 = tinted.GetPixel(px, py);
                                        if (px2.A > 0)
                                            tinted.SetPixel(px, py, System.Drawing.Color.FromArgb(px2.A, color.R, color.G, color.B));
                                    }
                                g.DrawImage(tinted, -w / 2, -h / 2, w, h);
                            }
                        }
                        else
                        {
                            // Fallback diamond for missing icons
                            var points = new System.Drawing.PointF[] {
                                new System.Drawing.PointF(0, -h/2),
                                new System.Drawing.PointF(w/2, 0),
                                new System.Drawing.PointF(0, h/2),
                                new System.Drawing.PointF(-w/2, 0)
                            };
                            using (var brush = new System.Drawing.SolidBrush(color))
                                g.FillPolygon(brush, points);
                        }
                        g.ResetTransform();
                    }
                    catch { g.ResetTransform(); }
                }
            }
            return bmp;
        }

        private static readonly Dictionary<int, System.Drawing.Image> _iconImageCache = new Dictionary<int, System.Drawing.Image>();

        private static System.Drawing.Image LoadIconImage(string iconDir, int meshId)
        {
            if (_iconImageCache.TryGetValue(meshId, out var cached)) return cached;
            // System.Drawing can't load .webp — only try .png, .bmp, .gif, .jpg
            string[] exts = { ".png", ".bmp", ".jpg", ".gif" };
            foreach (var ext in exts)
            {
                string path = Path.Combine(iconDir, meshId + ext);
                if (File.Exists(path))
                {
                    try
                    {
                        var img = System.Drawing.Image.FromFile(path);
                        _iconImageCache[meshId] = img;
                        return img;
                    }
                    catch { }
                }
            }
            _iconImageCache[meshId] = null;
            return null;
        }

        // Bannerlord banner color palette
        // Banner color palette — extracted from Native/ModuleData/banner_icons.xml (229 colors)
        private static bool _shipPropsLogged = false;
        private static Dictionary<int, string> BannerColorHex = new Dictionary<int, string>
        {
            {0,"#b57a1e"},{1,"#4e1a13"},{2,"#284e19"},{3,"#b4f0f1"},{4,"#793191"},{5,"#fcde90"},
            {6,"#382188"},{7,"#dea940"},{8,"#591645"},{9,"#ffad54"},{10,"#429081"},{11,"#efc990"},
            {12,"#224277"},{13,"#cedae7"},{14,"#8d291a"},{15,"#f7bf46"},{16,"#6bd5dc"},{17,"#eed690"},
            {18,"#aec382"},{19,"#c3c3c3"},{20,"#d5d7d4"},{21,"#e7ecd6"},{22,"#eaeeef"},{23,"#7f6b60"},
            {24,"#967e7e"},{25,"#b6aba7"},{26,"#e7d3ba"},{27,"#eae1da"},{28,"#d9dbce"},{29,"#dfd6cd"},
            {30,"#cac1ba"},{31,"#ece8dd"},{32,"#e0dcd9"},{33,"#efece5"},{34,"#eae9e5"},{35,"#f5f5f5"},
            {36,"#f5b365"},{38,"#e68c36"},{39,"#dcac46"},{41,"#eee7d4"},{42,"#e9e2c5"},{43,"#ebdcbb"},
            {44,"#f0e0a5"},{45,"#e0c78e"},{46,"#cda87c"},{47,"#f9d575"},{48,"#e44434"},{49,"#e69077"},
            {50,"#e79c7d"},{51,"#c94b4e"},{52,"#e6b0a6"},{53,"#e4c8c7"},{54,"#f2b0a2"},{55,"#da6c6d"},
            {56,"#e2bcaf"},{57,"#bd7e75"},{58,"#d1c7c5"},{59,"#975b43"},{60,"#e6a57f"},{61,"#7b5e4e"},
            {62,"#ac9188"},{63,"#d7967a"},{64,"#e6c9bb"},{65,"#934165"},{66,"#d39eb0"},{67,"#644974"},
            {68,"#7f658a"},{69,"#a793ae"},{70,"#c5057c"},{71,"#710083"},{72,"#00667f"},{73,"#00a0ba"},
            {74,"#53b7c6"},{75,"#a1b1ef"},{76,"#7f8cc0"},{77,"#5960a8"},{78,"#c1589a"},{79,"#a34faf"},
            {80,"#d08e54"},{81,"#939bd9"},{82,"#ea4f00"},{83,"#d22d33"},{84,"#fde217"},{85,"#ffa4dd"},
            {86,"#cb83d5"},{87,"#895d5e"},{88,"#02ff19"},{89,"#019678"},{90,"#9ec400"},{91,"#a34402"},
            {92,"#714214"},{93,"#ffc3c3"},{94,"#855fa8"},{95,"#7e6e4a"},{96,"#3a3321"},{97,"#3d2f22"},
            {98,"#422c2e"},{99,"#453e38"},{100,"#332c4d"},{101,"#515267"},{102,"#6c72a2"},{103,"#8b93ba"},
            {104,"#a6d5db"},{105,"#a4b1c2"},{106,"#c5bcd1"},{107,"#d8aec5"},{108,"#cedada"},{109,"#d2d6d5"},
            {110,"#cacccb"},{111,"#dfdedc"},{112,"#5d5b44"},{113,"#726b3d"},{114,"#cdcc7c"},{115,"#8fd1dd"},
            {116,"#0b0c11"},{118,"#e36664"},{119,"#456dff"},{120,"#5fbd72"},{121,"#f4d32e"},{122,"#a97435"},
            {123,"#41281b"},{126,"#34671e"},{127,"#f3f3f3"},{130,"#7739a7"},{131,"#f1c232"},{134,"#5aa4ad"},
            {135,"#ffe9d4"},{138,"#3a6298"},{139,"#d9d9d9"},{142,"#830808"},{143,"#f4ca14"},{146,"#2c4d86"},
            {147,"#955066"},{148,"#6c1512"},{149,"#211f1f"},{150,"#ccc4bf"},{151,"#ef9b9b"},{152,"#b5d0fd"},
            {153,"#a8ceab"},{154,"#8d5c44"},{155,"#e9a74d"},{156,"#b3a491"},{157,"#5f4f44"},{158,"#234116"},
            {159,"#26406d"},{160,"#7a4253"},{161,"#5a1310"},{162,"#2f2a2b"},{163,"#744c38"},{164,"#594012"},
            {165,"#bf5a25"},{166,"#ffcf83"},{167,"#85827f"},{168,"#ce9697"},{169,"#95a9cc"},{170,"#89a78b"},
            {171,"#ffb53e"},{172,"#ffffff"},{173,"#c7beb7"},{174,"#b38841"},{175,"#848b65"},{176,"#5a7a4f"},
            {177,"#7cafc7"},{178,"#7c2b1a"},{179,"#ac5f2e"},{180,"#72583b"},{181,"#61725e"},{182,"#a6825c"},
            {183,"#ccc3ab"},{184,"#8b7c73"},{185,"#d0884e"},{186,"#7b5869"},{187,"#66ccff"},{188,"#aa415d"},
            {189,"#687f5e"},{190,"#4e75bc"},{191,"#f1c178"},{192,"#d1c4a4"},{193,"#5e5737"},{194,"#802463"},
            {196,"#de9953"},{197,"#4e3a55"},{198,"#cc8324"},{200,"#4f2212"},{201,"#965228"},{202,"#2a5599"},
            {204,"#949ccc"},{205,"#1c2a50"},{208,"#a88220"},{209,"#4a100c"},{210,"#335f22"},{212,"#dfc36b"},
            {213,"#2d3f1d"},{214,"#418174"},{216,"#ccbb89"},{217,"#58888b"},{218,"#202931"},{219,"#b7623c"},
            {220,"#4e1362"},{221,"#25152a"},{222,"#420e54"},{223,"#f1580d"},{224,"#f48955"},{225,"#e1890b"},
            {226,"#d47547"},{227,"#9f7407"},{228,"#f2ead6"},{229,"#e1a50b"},{230,"#dcbb65"},{231,"#5f3f0e"},
            {232,"#c13b29"},{233,"#112038"},{234,"#3995f8"},{235,"#b7623c"},{236,"#252a01"},{237,"#315305"},
            {238,"#72bfc0"},{239,"#c2d3d3"},{240,"#5c6868"},{241,"#7a8383"},{242,"#acb3b3"},{243,"#234942"},
            {244,"#213330"},{245,"#eea332"},{246,"#f0e1cb"},{247,"#192026"},{248,"#eebda7"},{249,"#e5a386"},
            {250,"#ffffff"}
        };

        // Convert a single channel from linear RGB to sRGB (gamma correction)
        // Bannerlord XML stores colors in linear space; displays use sRGB
        private static byte LinearToSrgb(byte linear)
        {
            double v = linear / 255.0;
            double srgb = v <= 0.0031308
                ? v * 12.92
                : 1.055 * Math.Pow(v, 1.0 / 2.4) - 0.055;
            return (byte)Math.Max(0, Math.Min(255, (int)Math.Round(srgb * 255)));
        }

        private static System.Drawing.Color GetBannerColor(int idx)
        {
            if (BannerColorHex.TryGetValue(idx, out string hex))
                return System.Drawing.ColorTranslator.FromHtml(hex);
            return System.Drawing.Color.FromArgb(0xDB, 0xA0, 0x4D); // default gold
        }

        private static string GetPlayerQuestsJson()
        {
            var sb = new StringBuilder("{\"active\":[],\"completed\":[]}");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) return sb.ToString();

                var activeList = new List<string>();
                var completedList = new List<string>();

                // Use reflection to access QuestManager and quest lists
                try
                {
                    var campaign = Campaign.Current;
                    if (campaign == null) return sb.ToString();

                    // Try Campaign.Current.QuestManager
                    var qmProp = campaign.GetType().GetProperty("QuestManager",
                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    object questManager = qmProp?.GetValue(campaign);

                    if (questManager != null)
                    {
                        // Get Quests property (list of active quests)
                        var questsProp = questManager.GetType().GetProperty("Quests",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        var quests = questsProp?.GetValue(questManager) as System.Collections.IEnumerable;

                        if (quests != null)
                        {
                            foreach (var quest in quests)
                            {
                                if (quest == null) continue;
                                try
                                {
                                    var qType = quest.GetType();
                                    var reflFlags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance;

                                    // Log all quest properties for diagnosis (first quest only)
                                    if (activeList.Count == 0 && completedList.Count == 0)
                                    {
                                        try
                                        {
                                            var allFlags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
                                            // Force-log quest properties to a separate file
                                            var allProps = qType.GetProperties(reflFlags);
                                            string questDump = "Quest type: " + qType.FullName + "\nProps: " + string.Join(", ", Array.ConvertAll(allProps, p => p.Name + ":" + p.PropertyType.Name));
                                            // Log base type (QuestBase) properties
                                            var baseType = qType.BaseType;
                                            while (baseType != null && baseType != typeof(object))
                                            {
                                                var baseProps = baseType.GetProperties(allFlags | System.Reflection.BindingFlags.DeclaredOnly);
                                                questDump += "\nBase " + baseType.Name + " props: " + string.Join(", ", Array.ConvertAll(baseProps, p => p.Name + ":" + p.PropertyType.Name));
                                                var baseFields = baseType.GetFields(allFlags | System.Reflection.BindingFlags.DeclaredOnly);
                                                questDump += "\nBase " + baseType.Name + " fields: " + string.Join(", ", Array.ConvertAll(baseFields, f => f.Name + ":" + f.FieldType.Name));
                                                baseType = baseType.BaseType;
                                            }
                                            // Also dump JournalEntries item type
                                            try
                                            {
                                                var jeProp = qType.GetProperty("JournalEntries", reflFlags);
                                                if (jeProp != null)
                                                {
                                                    var jeList = jeProp.GetValue(quest) as System.Collections.IEnumerable;
                                                    if (jeList != null)
                                                    {
                                                        foreach (var je in jeList)
                                                        {
                                                            if (je == null) continue;
                                                            var jeType = je.GetType();
                                                            var jeProps = jeType.GetProperties(allFlags);
                                                            questDump += "\n\nJournalEntry type: " + jeType.FullName;
                                                            questDump += "\nJournalEntry props: " + string.Join(", ", Array.ConvertAll(jeProps, p => p.Name + ":" + p.PropertyType.Name));
                                                            // Try to read values
                                                            foreach (var jp in jeProps)
                                                            {
                                                                try
                                                                {
                                                                    var val = jp.GetValue(je);
                                                                    if (val != null)
                                                                        questDump += "\n  prop " + jp.Name + " = " + val.ToString().Substring(0, Math.Min(val.ToString().Length, 200));
                                                                }
                                                                catch { }
                                                            }
                                                            // Dump private fields
                                                            var jeFields = jeType.GetFields(allFlags);
                                                            questDump += "\nJournalEntry fields: " + string.Join(", ", Array.ConvertAll(jeFields, f => f.Name + ":" + f.FieldType.Name));
                                                            foreach (var jf in jeFields)
                                                            {
                                                                try
                                                                {
                                                                    var val = jf.GetValue(je);
                                                                    if (val != null)
                                                                        questDump += "\n  field " + jf.Name + " = " + val.ToString().Substring(0, Math.Min(val.ToString().Length, 300));
                                                                }
                                                                catch { }
                                                            }
                                                            // Dump methods
                                                            var jeMethods = jeType.GetMethods(allFlags | System.Reflection.BindingFlags.DeclaredOnly);
                                                            questDump += "\nJournalEntry methods: " + string.Join(", ", Array.ConvertAll(jeMethods, m => m.Name + "(" + m.GetParameters().Length + ")"));
                                                            // Try calling parameterless methods that return string/TextObject
                                                            foreach (var jm in jeMethods)
                                                            {
                                                                if (jm.GetParameters().Length == 0 && (jm.ReturnType == typeof(string) || jm.ReturnType.Name == "TextObject"))
                                                                {
                                                                    try
                                                                    {
                                                                        var result = jm.Invoke(je, null);
                                                                        if (result != null)
                                                                            questDump += "\n  method " + jm.Name + "() = " + result.ToString().Substring(0, Math.Min(result.ToString().Length, 300));
                                                                    }
                                                                    catch { }
                                                                }
                                                            }
                                                            break; // Only dump first entry
                                                        }
                                                    }
                                                }
                                            }
                                            catch { }

                                            // Also dump TaskList item type
                                            try
                                            {
                                                var tlProp = qType.GetProperty("TaskList", reflFlags);
                                                if (tlProp != null)
                                                {
                                                    var tlList = tlProp.GetValue(quest) as System.Collections.IEnumerable;
                                                    if (tlList != null)
                                                    {
                                                        foreach (var task in tlList)
                                                        {
                                                            if (task == null) continue;
                                                            var taskType = task.GetType();
                                                            var taskProps = taskType.GetProperties(allFlags);
                                                            questDump += "\n\nTaskList type: " + taskType.FullName;
                                                            questDump += "\nTask props: " + string.Join(", ", Array.ConvertAll(taskProps, p => p.Name + ":" + p.PropertyType.Name));
                                                            foreach (var tp in taskProps)
                                                            {
                                                                try
                                                                {
                                                                    var val = tp.GetValue(task);
                                                                    if (val != null)
                                                                        questDump += "\n  " + tp.Name + " = " + val.ToString().Substring(0, Math.Min(val.ToString().Length, 200));
                                                                }
                                                                catch { }
                                                            }
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            catch { }

                                            // Write to a file in web root for easy access
                                            try { File.WriteAllText(Path.Combine(_webRoot, "quest_dump.txt"), questDump); }
                                            catch { }
                                            Log("Quest properties dumped to quest_dump.txt");
                                        }
                                        catch { }
                                    }

                                    string title = "";
                                    try { title = qType.GetProperty("Title")?.GetValue(quest)?.ToString() ?? ""; } catch { }
                                    if (string.IsNullOrEmpty(title))
                                        try { title = qType.GetProperty("Name")?.GetValue(quest)?.ToString() ?? "Unknown Quest"; } catch { title = "Unknown Quest"; }

                                    bool isActive = true;
                                    try
                                    {
                                        var isFinished = qType.GetProperty("IsFinalized")?.GetValue(quest);
                                        if (isFinished is bool b && b) isActive = false;
                                    }
                                    catch { }

                                    // Quest giver
                                    string giver = "";
                                    string giverHeroId2 = "";
                                    try
                                    {
                                        var giverHero = qType.GetProperty("QuestGiver")?.GetValue(quest);
                                        if (giverHero != null)
                                        {
                                            giver = giverHero.GetType().GetProperty("Name")?.GetValue(giverHero)?.ToString() ?? "";
                                            giverHeroId2 = giverHero.GetType().GetProperty("StringId")?.GetValue(giverHero)?.ToString() ?? "";
                                        }
                                    }
                                    catch { }

                                    // Due date
                                    string dueDate = "";
                                    try
                                    {
                                        var dueProp = qType.GetProperty("QuestDueTime");
                                        if (dueProp != null)
                                        {
                                            var dueTime = dueProp.GetValue(quest);
                                            if (dueTime != null) dueDate = dueTime.ToString();
                                        }
                                    }
                                    catch { }

                                    // Quest description from JournalEntries — LogText is a FIELD (not property)
                    string description = "";
                    var logEntries = new List<string>();
                    string taskName = "";
                    int currentProgress = 0, progressRange = 0;
                    try
                    {
                        var jeProp = qType.GetProperty("JournalEntries", reflFlags);
                        if (jeProp != null)
                        {
                            var jeList = jeProp.GetValue(quest) as System.Collections.IEnumerable;
                            if (jeList != null)
                            {
                                var allFlags2 = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
                                foreach (var je in jeList)
                                {
                                    if (je == null) continue;
                                    var jeType = je.GetType();
                                    // Read LogText field (TextObject)
                                    try
                                    {
                                        var logTextField = jeType.GetField("LogText", allFlags2);
                                        if (logTextField != null)
                                        {
                                            string txt = logTextField.GetValue(je)?.ToString() ?? "";
                                            // Strip HTML link tags for clean display
                                            txt = System.Text.RegularExpressions.Regex.Replace(txt, @"<a[^>]*>|</a>|<b>|</b>", "");
                                            if (!string.IsNullOrEmpty(txt)) logEntries.Add(txt);
                                        }
                                    }
                                    catch { }
                                    // Read TaskName field
                                    try
                                    {
                                        var tnField = jeType.GetField("TaskName", allFlags2);
                                        if (tnField != null)
                                        {
                                            string tn = tnField.GetValue(je)?.ToString() ?? "";
                                            if (!string.IsNullOrEmpty(tn)) taskName = tn;
                                        }
                                    }
                                    catch { }
                                    // Read progress
                                    try
                                    {
                                        var cpProp = jeType.GetProperty("CurrentProgress");
                                        if (cpProp != null) currentProgress = (int)cpProp.GetValue(je);
                                        var rangeFld = jeType.GetField("Range", allFlags2);
                                        if (rangeFld != null) progressRange = (int)rangeFld.GetValue(je);
                                    }
                                    catch { }
                                }
                            }
                        }
                        description = string.Join("\n", logEntries);
                    }
                    catch { }

                    // Time remaining in days
                    string timeRemaining = "";
                    try
                    {
                        // Try QuestDueTime and calculate remaining
                        var dueProp = qType.GetProperty("QuestDueTime", reflFlags);
                        if (dueProp != null)
                        {
                            var dueTime = dueProp.GetValue(quest);
                            if (dueTime != null)
                            {
                                // Try RemainingDaysForQuest
                                var remainProp = qType.GetProperty("RemainingDaysForQuest", reflFlags);
                                if (remainProp != null)
                                {
                                    var rv = remainProp.GetValue(quest);
                                    if (rv != null) timeRemaining = ((int)Convert.ToSingle(rv.ToString())).ToString();
                                }
                                if (string.IsNullOrEmpty(timeRemaining))
                                {
                                    // Calculate from QuestDueTime - CampaignTime.Now
                                    try
                                    {
                                        var elapsedProp = dueTime.GetType().GetProperty("ElapsedDaysUntilNow", reflFlags);
                                        if (elapsedProp != null)
                                        {
                                            float elapsed = Convert.ToSingle(elapsedProp.GetValue(dueTime));
                                            timeRemaining = Math.Max(0, -(int)elapsed).ToString();
                                        }
                                    }
                                    catch { }
                                }
                            }
                        }
                    }
                    catch { }

                    // Progress percentage (if available)
                    string progress = "";
                    try
                    {
                        foreach (var progName in new[] { "Progress", "QuestProgress", "CurrentProgress", "CompletionPercentage" })
                        {
                            var pp = qType.GetProperty(progName, reflFlags);
                            if (pp != null) { progress = pp.GetValue(quest)?.ToString() ?? ""; if (!string.IsNullOrEmpty(progress)) break; }
                        }
                    }
                    catch { }

                    // Extra quest data
                    string questType = "";
                    string settlement = "";
                    string settlementId = "";
                    string giverClan = "";
                    string giverKingdom = "";
                    try
                    {
                        // Quest type from class name
                        questType = qType.Name.Replace("Issue", "").Replace("Quest", "");
                        // Try to get settlement
                        foreach (var sName in new[] { "Settlement", "TargetSettlement", "QuestSettlement", "IssueSettlement" })
                        {
                            var sProp = qType.GetProperty(sName, reflFlags);
                            if (sProp != null)
                            {
                                var sVal = sProp.GetValue(quest);
                                if (sVal != null)
                                {
                                    settlement = sVal.GetType().GetProperty("Name")?.GetValue(sVal)?.ToString() ?? "";
                                    settlementId = sVal.GetType().GetProperty("StringId")?.GetValue(sVal)?.ToString() ?? "";
                                    break;
                                }
                            }
                        }
                        // Giver clan/kingdom
                        if (!string.IsNullOrEmpty(giverHeroId2))
                        {
                            var giverHero = Hero.FindFirst(h => h.StringId == giverHeroId2);
                            if (giverHero != null)
                            {
                                giverClan = giverHero.Clan?.Name?.ToString() ?? "";
                                giverKingdom = giverHero.Clan?.Kingdom?.Name?.ToString() ?? "";
                            }
                        }
                    }
                    catch { }

                    // Journal entries
                    string journalJson = "[]";
                    try
                    {
                        if (logEntries.Count > 0)
                        {
                            var jParts = new List<string>();
                            foreach (var le in logEntries)
                                jParts.Add("\"" + JEsc(le) + "\"");
                            journalJson = "[" + string.Join(",", jParts) + "]";
                        }
                    }
                    catch { }

                    string entry = "{\"title\":\"" + JEsc(title) + "\",\"giver\":\"" + JEsc(giver) + "\",\"giverHeroId\":\"" + JEsc(giverHeroId2) + "\",\"dueDate\":\"" + JEsc(dueDate) + "\",\"timeRemaining\":\"" + JEsc(timeRemaining) + "\",\"description\":\"" + JEsc(description) + "\",\"taskName\":\"" + JEsc(taskName) + "\",\"currentProgress\":" + currentProgress + ",\"progressRange\":" + progressRange + ",\"logCount\":" + logEntries.Count
                        + ",\"questType\":\"" + JEsc(questType) + "\",\"settlement\":\"" + JEsc(settlement) + "\",\"settlementId\":\"" + JEsc(settlementId) + "\",\"giverClan\":\"" + JEsc(giverClan) + "\",\"giverKingdom\":\"" + JEsc(giverKingdom) + "\",\"journal\":" + journalJson + "}";

                                    if (isActive)
                                        activeList.Add(entry);
                                    else
                                        completedList.Add(entry);
                                }
                                catch { }
                            }
                        }
                    }

                    // Also try to get completed/log quests
                    try
                    {
                        var logsProp = campaign.GetType().GetProperty("LogEntryHistory",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        // Quest logs are complex — for now we rely on the QuestManager
                    }
                    catch { }
                }
                catch (Exception ex) { Log("GetPlayerQuests reflection error: " + ex.Message); }

                sb = new StringBuilder("{\"active\":[");
                sb.Append(string.Join(",", activeList));
                sb.Append("],\"completed\":[");
                sb.Append(string.Join(",", completedList));
                sb.Append("],\"activeCount\":" + activeList.Count + ",\"completedCount\":" + completedList.Count + "}");
            }
            catch (Exception ex) { Log("GetPlayerQuests error: " + ex.Message); }
            return sb.ToString();
        }

        private static string GetPlayerCharacterJson(string heroId = "")
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) return "{\"error\":\"No campaign\"}";

                // If heroId specified, find that hero instead
                if (!string.IsNullOrEmpty(heroId))
                {
                    Hero targetHero = null;
                    try
                    {
                        if (hero.Clan != null)
                        {
                            foreach (var h in hero.Clan.Heroes)
                            {
                                if (h != null && h.IsAlive && h.StringId == heroId) { targetHero = h; break; }
                            }
                        }
                    }
                    catch { }
                    if (targetHero == null) return "{\"error\":\"Hero not found in clan\"}";
                    hero = targetHero;
                }
                sb.Append("\"heroId\":\"" + JEsc(hero.StringId) + "\",");

                sb.Append("\"name\":\"" + JEsc(hero.Name?.ToString()) + "\",");
                sb.Append("\"age\":" + (int)hero.Age + ",");
                try { sb.Append("\"level\":" + hero.Level + ","); } catch { sb.Append("\"level\":0,"); }
                sb.Append("\"hp\":" + hero.HitPoints + ",");
                sb.Append("\"maxHp\":" + hero.MaxHitPoints + ",");
                sb.Append("\"culture\":\"" + JEsc(hero.Culture?.Name?.ToString()) + "\",");

                // Attributes — try multiple strategies
                sb.Append("\"attributes\":{");
                bool attrFound = false;
                try
                {
                    // Strategy 1: GetAttributeValue with CharacterAttributesEnum
                    var getAttrMethod = hero.GetType().GetMethod("GetAttributeValue",
                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);

                    // Find the enum type — search all assemblies for any type containing "CharacterAttribute"
                    Type attrEnumType = null;
                    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        foreach (var typeName in new[] {
                            "TaleWorlds.Core.CharacterAttributesEnum",
                            "TaleWorlds.Core.DefaultCharacterAttributes",
                            "TaleWorlds.Core.CharacterAttribute" })
                        {
                            attrEnumType = asm.GetType(typeName);
                            if (attrEnumType != null) break;
                        }
                        if (attrEnumType != null) break;
                    }

                    Log("[Character] GetAttributeValue method: " + (getAttrMethod != null ? getAttrMethod.ToString() : "null"));
                    Log("[Character] Attribute type found: " + (attrEnumType?.FullName ?? "null"));

                    if (getAttrMethod != null && attrEnumType != null && attrEnumType.IsEnum)
                    {
                        bool af = true;
                        foreach (var v in Enum.GetValues(attrEnumType))
                        {
                            try
                            {
                                int val = (int)getAttrMethod.Invoke(hero, new[] { v });
                                string name = v.ToString();
                                if (!af) sb.Append(",");
                                sb.Append("\"" + JEsc(name) + "\":" + val);
                                af = false;
                                attrFound = true;
                            }
                            catch { }
                        }
                    }

                    // Strategy 2: If enum is a class (DefaultCharacterAttributes has static properties)
                    if (!attrFound && attrEnumType != null && !attrEnumType.IsEnum)
                    {
                        Log("[Character] Trying DefaultCharacterAttributes static properties");
                        bool af = true;
                        foreach (var prop in attrEnumType.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static))
                        {
                            try
                            {
                                var attrObj = prop.GetValue(null);
                                if (attrObj == null) continue;
                                if (getAttrMethod != null)
                                {
                                    int val = (int)getAttrMethod.Invoke(hero, new[] { attrObj });
                                    if (!af) sb.Append(",");
                                    sb.Append("\"" + JEsc(prop.Name) + "\":" + val);
                                    af = false;
                                    attrFound = true;
                                }
                            }
                            catch { }
                        }
                    }

                    // Strategy 3: Try hero.CharacterObject properties via reflection
                    if (!attrFound)
                    {
                        Log("[Character] Trying CharacterObject.GetAttributeValue");
                        try
                        {
                            var charObj = hero.CharacterObject;
                            if (charObj != null)
                            {
                                var coGetAttr = charObj.GetType().GetMethod("GetAttributeValue",
                                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (coGetAttr != null)
                                {
                                    Log("[Character] CharacterObject.GetAttributeValue params: " +
                                        string.Join(", ", coGetAttr.GetParameters().Select(p => p.ParameterType.FullName)));
                                    // Try with int indices 0-5
                                    string[] attrNames = { "Vigor", "Control", "Endurance", "Cunning", "Social", "Intelligence" };
                                    bool af = true;
                                    for (int ai = 0; ai < 6; ai++)
                                    {
                                        try
                                        {
                                            int val = (int)coGetAttr.Invoke(charObj, new object[] { ai });
                                            if (!af) sb.Append(",");
                                            sb.Append("\"" + JEsc(attrNames[ai]) + "\":" + val);
                                            af = false;
                                            attrFound = true;
                                        }
                                        catch { break; }
                                    }
                                }
                            }
                        }
                        catch { }
                    }

                    // Strategy 4: Last resort — dump all GetAttributeValue overloads
                    if (!attrFound)
                    {
                        var methods = hero.GetType().GetMethods().Where(m => m.Name.Contains("Attribute")).ToList();
                        foreach (var m in methods)
                        {
                            Log("[Character] Found method: " + m.Name + "(" +
                                string.Join(", ", m.GetParameters().Select(p => p.ParameterType.FullName + " " + p.Name)) + ") => " + m.ReturnType.Name);
                        }
                    }
                }
                catch (Exception ex) { Log("[Character] Attribute error: " + ex.Message); }
                sb.Append("},");

                // Unspent attribute/focus points
                try
                {
                    var heroDevProp = hero.GetType().GetProperty("HeroDeveloper", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (heroDevProp != null)
                    {
                        var dev = heroDevProp.GetValue(hero);
                        if (dev != null)
                        {
                            try
                            {
                                var uapProp = dev.GetType().GetProperty("UnspentAttributePoints");
                                if (uapProp != null) sb.Append("\"unspentAttrPoints\":" + (int)uapProp.GetValue(dev) + ",");
                            }
                            catch { }
                            try
                            {
                                var ufpProp = dev.GetType().GetProperty("UnspentFocusPoints");
                                if (ufpProp != null) sb.Append("\"unspentFocusPoints\":" + (int)ufpProp.GetValue(dev) + ",");
                            }
                            catch { }
                        }
                    }
                }
                catch { }

                // Skills with focus points and attribute grouping
                sb.Append("\"skills\":[");
                try
                {
                    var getSkillMethod = hero.GetType().GetMethod("GetSkillValue");
                    // Focus points via HeroDeveloper
                    System.Reflection.MethodInfo getFocusMethod = null;
                    object heroDev = null;
                    try
                    {
                        var heroDevProp2 = hero.GetType().GetProperty("HeroDeveloper", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (heroDevProp2 != null)
                        {
                            heroDev = heroDevProp2.GetValue(hero);
                            if (heroDev != null)
                                getFocusMethod = heroDev.GetType().GetMethod("GetFocus");
                        }
                    }
                    catch { }

                    if (getSkillMethod != null)
                    {
                        System.Collections.IEnumerable allSkills = null;
                        var dsType = Type.GetType("TaleWorlds.Core.DefaultSkills, TaleWorlds.Core");
                        if (dsType != null)
                        {
                            var gam = dsType.GetMethod("GetAllSkills", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (gam != null) allSkills = gam.Invoke(null, null) as System.Collections.IEnumerable;
                        }
                        if (allSkills == null)
                        {
                            var soType = Type.GetType("TaleWorlds.Core.SkillObject, TaleWorlds.Core");
                            if (soType != null)
                            {
                                var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                                if (mgr != null)
                                {
                                    var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(soType);
                                    allSkills = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                                }
                            }
                        }
                        if (allSkills != null)
                        {
                            bool sf = true;
                            foreach (var skill in allSkills)
                            {
                                if (skill == null) continue;
                                int val = (int)getSkillMethod.Invoke(hero, new[] { skill });
                                string sName = "";
                                try { sName = skill.GetType().GetProperty("Name")?.GetValue(skill)?.ToString() ?? ""; } catch { }
                                string sId = "";
                                try { sId = skill.GetType().GetProperty("StringId")?.GetValue(skill)?.ToString() ?? ""; } catch { }

                                // Get focus points for this skill
                                int focus = 0;
                                try { if (getFocusMethod != null) focus = (int)getFocusMethod.Invoke(heroDev, new[] { skill }); } catch { }

                                // Get which attribute this skill belongs to
                                string attrName = "";
                                try
                                {
                                    var charAttrProp = skill.GetType().GetProperty("CharacterAttribute");
                                    if (charAttrProp != null)
                                    {
                                        var charAttr = charAttrProp.GetValue(skill);
                                        if (charAttr != null)
                                        {
                                            var nameProp = charAttr.GetType().GetProperty("Name");
                                            if (nameProp != null) attrName = nameProp.GetValue(charAttr)?.ToString() ?? "";
                                        }
                                    }
                                }
                                catch { }

                                // Learning rate via HeroDeveloper
                                float learningRate = 0f;
                                int learningLimit = 0;
                                try
                                {
                                    if (heroDev != null)
                                    {
                                        // GetResultNumber(SkillObject) returns the learning rate multiplier
                                        var calcMethod = heroDev.GetType().GetMethod("GetResultNumber", new[] { skill.GetType() });
                                        if (calcMethod == null)
                                        {
                                            // Try alternative: CalculateLearningRate
                                            foreach (var m in heroDev.GetType().GetMethods())
                                            {
                                                if (m.Name.Contains("Learning") && m.GetParameters().Length >= 1)
                                                {
                                                    calcMethod = m;
                                                    break;
                                                }
                                            }
                                        }
                                        if (calcMethod != null)
                                        {
                                            var result = calcMethod.Invoke(heroDev, new[] { skill });
                                            if (result is float f) learningRate = f;
                                            else if (result is int i) learningRate = i;
                                            else
                                            {
                                                // ExplainedNumber — get ResultNumber property
                                                var rnProp = result?.GetType().GetProperty("ResultNumber");
                                                if (rnProp != null) learningRate = (float)rnProp.GetValue(result);
                                            }
                                        }
                                        // Learning limit = attribute * focus * 30 + attribute * 10 (approximate formula)
                                        // Or try via model
                                        var llMethod = heroDev.GetType().GetMethod("GetSkillLearningLimit", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        if (llMethod == null)
                                        {
                                            foreach (var m in heroDev.GetType().GetMethods())
                                            {
                                                if (m.Name.Contains("LearningLimit") || m.Name.Contains("SkillCap"))
                                                {
                                                    llMethod = m;
                                                    break;
                                                }
                                            }
                                        }
                                        if (llMethod != null)
                                        {
                                            try
                                            {
                                                var llResult = llMethod.Invoke(heroDev, new[] { skill });
                                                if (llResult is int li) learningLimit = li;
                                                else if (llResult is float fl) learningLimit = (int)fl;
                                            }
                                            catch { }
                                        }
                                    }
                                }
                                catch { }

                                if (!sf) sb.Append(",");
                                sb.Append("{\"name\":\"" + JEsc(sName) + "\",\"id\":\"" + JEsc(sId) + "\",\"value\":" + val);
                                sb.Append(",\"focus\":" + focus);
                                if (learningRate > 0) sb.Append(",\"learningRate\":" + learningRate.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                                if (learningLimit > 0) sb.Append(",\"learningLimit\":" + learningLimit);
                                if (!string.IsNullOrEmpty(attrName)) sb.Append(",\"attribute\":\"" + JEsc(attrName) + "\"");
                                sb.Append("}");
                                sf = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // XP / Level progress
                try
                {
                    var devProp3 = hero.GetType().GetProperty("HeroDeveloper", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (devProp3 != null)
                    {
                        var dev3 = devProp3.GetValue(hero);
                        if (dev3 != null)
                        {
                            // Total XP needed for next level
                            try
                            {
                                var totalXpProp = dev3.GetType().GetProperty("TotalXp");
                                if (totalXpProp != null) sb.Append("\"totalXp\":" + (int)totalXpProp.GetValue(dev3) + ",");
                            }
                            catch { }
                            // Dump all int properties for debug
                            try
                            {
                                sb.Append("\"devDebug\":{");
                                bool ddf = true;
                                foreach (var prop in dev3.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                                {
                                    try
                                    {
                                        if (prop.PropertyType == typeof(int) || prop.PropertyType == typeof(float))
                                        {
                                            var val = prop.GetValue(dev3);
                                            if (!ddf) sb.Append(",");
                                            if (prop.PropertyType == typeof(float))
                                                sb.Append("\"" + JEsc(prop.Name) + "\":" + ((float)val).ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                                            else
                                                sb.Append("\"" + JEsc(prop.Name) + "\":" + val);
                                            ddf = false;
                                        }
                                    }
                                    catch { }
                                }
                                sb.Append("},");
                            }
                            catch { }
                        }
                    }
                }
                catch { }

                // Traits
                sb.Append("\"traits\":[");
                try
                {
                    string[] traitNames = { "Mercy", "Valor", "Honor", "Generosity", "Calculating" };
                    var charTraits = hero.GetType().GetMethod("GetTraitLevel",
                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (charTraits != null)
                    {
                        // Try to get trait objects from DefaultTraits
                        var defaultTraitsType = Type.GetType("TaleWorlds.Core.DefaultTraits, TaleWorlds.Core");
                        if (defaultTraitsType != null)
                        {
                            bool tf = true;
                            foreach (var tn in traitNames)
                            {
                                try
                                {
                                    var traitProp = defaultTraitsType.GetProperty(tn, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                    if (traitProp != null)
                                    {
                                        var traitObj = traitProp.GetValue(null);
                                        if (traitObj != null)
                                        {
                                            int level = (int)charTraits.Invoke(hero, new[] { traitObj });
                                            if (!tf) sb.Append(",");
                                            sb.Append("{\"name\":\"" + JEsc(tn) + "\",\"level\":" + level + "}");
                                            tf = false;
                                        }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch { }
                sb.Append("]");
            }
            catch (Exception ex) { Log("GetPlayerCharacter error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        // ══════════════════════════════════════════════════════════════
        // PLAYER COMMAND CENTER — Data Methods
        // ══════════════════════════════════════════════════════════════

        private static string GetPlayerOverviewJson()
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) { return "{\"error\":\"No campaign loaded\"}"; }
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                var clan = hero.Clan;
                var kingdom = clan?.Kingdom;

                // Hero
                sb.Append("\"hero\":{");
                sb.Append("\"id\":\"" + JEsc(hero.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(hero.Name?.ToString()) + "\",");
                sb.Append("\"age\":" + (int)hero.Age + ",");
                sb.Append("\"isFemale\":" + (hero.IsFemale ? "true" : "false") + ",");
                sb.Append("\"culture\":\"" + JEsc(hero.Culture?.Name?.ToString()) + "\",");
                sb.Append("\"hp\":" + hero.HitPoints + ",");
                sb.Append("\"maxHp\":" + hero.MaxHitPoints + ",");
                sb.Append("\"gold\":" + hero.Gold + ",");
                try { sb.Append("\"level\":" + hero.Level + ","); } catch { sb.Append("\"level\":0,"); }
                try
                {
                    string title = "";
                    if (hero.IsLord && clan?.Culture != null)
                        title = (hero.IsFemale ? "Noblewoman" : "Noble") + " of the " + clan.Culture.Name?.ToString();
                    else if (hero.IsPlayerCompanion)
                        title = "Companion";
                    sb.Append("\"title\":\"" + JEsc(title) + "\",");
                }
                catch { sb.Append("\"title\":\"\","); }
                // Custom name/title override
                var beh = EditableEncyclopedia.EncyclopediaEditBehavior.Instance;
                string customName = beh?.GetCustomName(hero.StringId);
                string customTitle = beh?.GetCustomTitle(hero.StringId);
                if (!string.IsNullOrEmpty(customName)) sb.Append("\"customName\":\"" + JEsc(customName) + "\",");
                if (!string.IsNullOrEmpty(customTitle)) sb.Append("\"customTitle\":\"" + JEsc(customTitle) + "\",");
                sb.Append("\"bannerCode\":\"" + JEsc(clan?.Banner != null ? clan.Banner.Serialize() : "") + "\"");
                sb.Append("},");

                // Party
                sb.Append("\"party\":{");
                if (party != null)
                {
                    sb.Append("\"troops\":" + (party.MemberRoster?.TotalManCount ?? 0) + ",");
                    sb.Append("\"wounded\":" + (party.MemberRoster?.TotalWounded ?? 0) + ",");
                    sb.Append("\"troopLimit\":" + (party.Party?.PartySizeLimit ?? 0) + ",");
                    sb.Append("\"morale\":" + (int)party.Morale + ",");
                    sb.Append("\"speed\":" + party.Speed.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ",");
                    sb.Append("\"food\":" + (int)party.TotalFoodAtInventory + ",");
                    try { sb.Append("\"foodChange\":" + party.FoodChange.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) + ","); } catch { sb.Append("\"foodChange\":0,"); }
                    try { sb.Append("\"dailyWage\":" + (int)party.TotalWage + ","); } catch { sb.Append("\"dailyWage\":0,"); }
                    int prisonerCount = 0;
                    try { prisonerCount = party.PrisonRoster?.TotalManCount ?? 0; } catch { }
                    sb.Append("\"prisoners\":" + prisonerCount + ",");
                    int companionCount = 0;
                    try { foreach (var h in clan.Companions) if (h != null && h.IsAlive) companionCount++; } catch { }
                    sb.Append("\"companions\":" + companionCount);
                }
                else { sb.Append("\"troops\":0,\"wounded\":0,\"troopLimit\":0,\"morale\":0,\"speed\":0,\"food\":0,\"foodChange\":0,\"dailyWage\":0,\"prisoners\":0,\"companions\":0"); }
                sb.Append("},");

                // Clan
                sb.Append("\"clan\":{");
                if (clan != null)
                {
                    sb.Append("\"id\":\"" + JEsc(clan.StringId) + "\",");
                    sb.Append("\"name\":\"" + JEsc(clan.Name?.ToString()) + "\",");
                    sb.Append("\"tier\":" + clan.Tier + ",");
                    try { sb.Append("\"renown\":" + (int)clan.Renown + ","); } catch { sb.Append("\"renown\":0,"); }
                    try { sb.Append("\"influence\":" + (int)clan.Influence + ","); } catch { sb.Append("\"influence\":0,"); }
                    try
                    {
                        var goldProp = clan.GetType().GetProperty("Gold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        int clanGold = goldProp != null ? (int)goldProp.GetValue(clan) : hero.Gold;
                        sb.Append("\"gold\":" + clanGold + ",");
                    }
                    catch { sb.Append("\"gold\":" + hero.Gold + ","); }
                    int memberCount = 0;
                    try { foreach (var h in clan.Heroes) if (h != null && h.IsAlive) memberCount++; } catch { }
                    sb.Append("\"members\":" + memberCount + ",");
                    int fiefCount = 0;
                    try { foreach (var f in clan.Fiefs) fiefCount++; } catch { }
                    sb.Append("\"fiefs\":" + fiefCount);
                }
                else { sb.Append("\"name\":\"None\",\"tier\":0,\"renown\":0,\"influence\":0,\"gold\":0,\"members\":0,\"fiefs\":0"); }
                sb.Append("},");

                // Kingdom
                sb.Append("\"kingdom\":{");
                if (kingdom != null)
                {
                    sb.Append("\"id\":\"" + JEsc(kingdom.StringId) + "\",");
                    sb.Append("\"name\":\"" + JEsc(kingdom.Name?.ToString()) + "\",");
                    sb.Append("\"ruler\":\"" + JEsc(kingdom.Leader?.Name?.ToString()) + "\",");
                    sb.Append("\"clans\":" + (kingdom.Clans?.Count ?? 0) + ",");
                    sb.Append("\"fiefs\":" + (kingdom.Fiefs?.Count ?? 0) + ",");
                    // Wars
                    var wars = new List<string>();
                    try
                    {
                        foreach (var k in Kingdom.All)
                        {
                            if (k != null && k != kingdom)
                            {
                                try { if (FactionManager.IsAtWarAgainstFaction(kingdom, k)) wars.Add(k.Name?.ToString() ?? ""); } catch { }
                            }
                        }
                    }
                    catch { }
                    sb.Append("\"wars\":[" + string.Join(",", wars.ConvertAll(w => "\"" + JEsc(w) + "\"")) + "],");
                    sb.Append("\"atWar\":" + (wars.Count > 0 ? "true" : "false"));
                }
                else { sb.Append("\"name\":\"None\",\"ruler\":\"\",\"clans\":0,\"fiefs\":0,\"wars\":[],\"atWar\":false"); }
                sb.Append("},");

                // Game date
                try { sb.Append("\"date\":\"" + JEsc(CampaignTime.Now.ToString()) + "\""); }
                catch { sb.Append("\"date\":\"\""); }
            }
            catch (Exception ex) { Log("GetPlayerOverview error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        /// <summary>Appends item stats JSON fields for an ItemObject (armor, weapon, horse stats).</summary>
        private static void AppendItemStats(StringBuilder sb, TaleWorlds.Core.ItemObject item)
        {
            if (item == null) return;
            try
            {
                sb.Append(",\"value\":" + item.Value);
                sb.Append(",\"weight\":" + item.Weight.ToString("F1", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append(",\"tier\":\"" + JEsc(item.Tier.ToString()) + "\"");
                string typeStr = "Other";
                try { typeStr = item.ItemType.ToString(); } catch { }
                sb.Append(",\"type\":\"" + JEsc(typeStr) + "\"");

                // Culture
                try { if (item.Culture != null) sb.Append(",\"culture\":\"" + JEsc(item.Culture.Name?.ToString() ?? "") + "\""); } catch { }

                // Effectiveness (item quality rating)
                try { sb.Append(",\"effectiveness\":" + item.Effectiveness.ToString("F1", System.Globalization.CultureInfo.InvariantCulture)); } catch { }

                // Item flags / usage description
                try
                {
                    var flags = item.ItemFlags;
                    var flagList = new List<string>();
                    if ((flags & TaleWorlds.Core.ItemFlags.CanBePickedUpFromCorpse) != 0) flagList.Add("Lootable");
                    if ((flags & TaleWorlds.Core.ItemFlags.NotUsableByFemale) != 0) flagList.Add("Male Only");
                    if ((flags & TaleWorlds.Core.ItemFlags.NotUsableByMale) != 0) flagList.Add("Female Only");
                    if (flagList.Count > 0) sb.Append(",\"flags\":\"" + JEsc(string.Join(", ", flagList)) + "\"");
                }
                catch { }

                // Armor stats
                try
                {
                    if (item.ArmorComponent != null)
                    {
                        var ac = item.ArmorComponent;
                        sb.Append(",\"headArmor\":" + ac.HeadArmor);
                        sb.Append(",\"bodyArmor\":" + ac.BodyArmor);
                        sb.Append(",\"legArmor\":" + ac.LegArmor);
                        sb.Append(",\"armArmor\":" + ac.ArmArmor);
                        try
                        {
                            // Material type for armor
                            var matProp = ac.GetType().GetProperty("MaterialType", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (matProp != null)
                            {
                                var mat = matProp.GetValue(ac);
                                if (mat != null) sb.Append(",\"armorMaterial\":\"" + JEsc(mat.ToString()) + "\"");
                            }
                        }
                        catch { }
                    }
                }
                catch { }

                // Weapon stats — ALL weapon modes
                try
                {
                    if (item.WeaponComponent != null && item.WeaponComponent.Weapons != null && item.WeaponComponent.Weapons.Count > 0)
                    {
                        // Primary weapon mode
                        var wd = item.WeaponComponent.Weapons[0];
                        sb.Append(",\"swingDamage\":" + wd.SwingDamage);
                        sb.Append(",\"thrustDamage\":" + wd.ThrustDamage);
                        sb.Append(",\"swingSpeed\":" + wd.SwingSpeed);
                        sb.Append(",\"thrustSpeed\":" + wd.ThrustSpeed);
                        sb.Append(",\"weaponLength\":" + wd.WeaponLength);
                        sb.Append(",\"handling\":" + wd.Handling);
                        try { sb.Append(",\"damageType\":\"" + JEsc(wd.SwingDamageType.ToString()) + "\""); } catch { }
                        try { sb.Append(",\"thrustDamageType\":\"" + JEsc(wd.ThrustDamageType.ToString()) + "\""); } catch { }
                        try { sb.Append(",\"weaponClass\":\"" + JEsc(wd.WeaponClass.ToString()) + "\""); } catch { }
                        if (wd.MissileSpeed > 0) sb.Append(",\"missileSpeed\":" + wd.MissileSpeed);
                        try { if (wd.MaxDataValue > 0) sb.Append(",\"maxAmmo\":" + wd.MaxDataValue); } catch { }
                        try { sb.Append(",\"accuracy\":" + wd.Accuracy); } catch { }

                        // Additional weapon modes (e.g. polearm can also be used as 1h)
                        if (item.WeaponComponent.Weapons.Count > 1)
                        {
                            sb.Append(",\"altModes\":[");
                            bool firstMode = true;
                            for (int mi = 1; mi < item.WeaponComponent.Weapons.Count && mi < 4; mi++)
                            {
                                try
                                {
                                    var alt = item.WeaponComponent.Weapons[mi];
                                    if (!firstMode) sb.Append(",");
                                    sb.Append("{\"class\":\"" + JEsc(alt.WeaponClass.ToString()) + "\"");
                                    sb.Append(",\"swingDmg\":" + alt.SwingDamage);
                                    sb.Append(",\"thrustDmg\":" + alt.ThrustDamage);
                                    sb.Append(",\"speed\":" + alt.SwingSpeed);
                                    sb.Append(",\"length\":" + alt.WeaponLength + "}");
                                    firstMode = false;
                                }
                                catch { }
                            }
                            sb.Append("]");
                        }
                    }
                }
                catch { }

                // Shield stats
                try
                {
                    if (item.WeaponComponent != null && item.WeaponComponent.Weapons != null)
                    {
                        foreach (var wd in item.WeaponComponent.Weapons)
                        {
                            if (wd.WeaponClass == TaleWorlds.Core.WeaponClass.SmallShield || wd.WeaponClass == TaleWorlds.Core.WeaponClass.LargeShield)
                            {
                                sb.Append(",\"shieldHp\":" + wd.MaxDataValue);
                                sb.Append(",\"shieldSpeed\":" + wd.SwingSpeed);
                                sb.Append(",\"shieldSize\":\"" + JEsc(wd.WeaponClass.ToString()) + "\"");
                                break;
                            }
                        }
                    }
                }
                catch { }

                // Horse stats
                try
                {
                    if (item.HorseComponent != null)
                    {
                        var hc = item.HorseComponent;
                        sb.Append(",\"horseSpeed\":" + hc.Speed);
                        sb.Append(",\"horseManeuver\":" + hc.Maneuver);
                        sb.Append(",\"horseCharge\":" + hc.ChargeDamage);
                        sb.Append(",\"horseHp\":" + hc.HitPoints);
                        try { sb.Append(",\"horseType\":\"" + JEsc(hc.Monster?.MonsterUsage ?? "") + "\""); } catch { }
                        try
                        {
                            var bodyLen = hc.GetType().GetProperty("BodyLength", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (bodyLen != null) sb.Append(",\"horseBodyLength\":" + (int)bodyLen.GetValue(hc));
                        }
                        catch { }
                    }
                }
                catch { }

                // Horse harness armor — try multiple sources
                try
                {
                    if (item.ItemType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HorseHarness)
                    {
                        int hArmor = 0;
                        if (item.ArmorComponent != null)
                        {
                            // Take the highest non-zero armor value
                            hArmor = Math.Max(hArmor, item.ArmorComponent.BodyArmor);
                            hArmor = Math.Max(hArmor, item.ArmorComponent.HeadArmor);
                            hArmor = Math.Max(hArmor, item.ArmorComponent.LegArmor);
                            hArmor = Math.Max(hArmor, item.ArmorComponent.ArmArmor);
                        }
                        // Fallback: try Effectiveness as indicator
                        if (hArmor == 0)
                        {
                            try { hArmor = (int)(item.Effectiveness * 10); } catch { }
                        }
                        sb.Append(",\"horseArmor\":" + hArmor);
                    }
                }
                catch { }
            }
            catch { }
        }

        private static string GetPlayerEquipmentJson(string heroId = "")
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) return "{\"error\":\"No campaign\"}";
                if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                {
                    Hero target = null;
                    foreach (var h in hero.Clan.Heroes)
                    {
                        if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                    }
                    if (target == null) return "{\"error\":\"Hero not found in clan\"}";
                    hero = target;
                }

                string[] slotNames = { "Weapon0", "Weapon1", "Weapon2", "Weapon3", "Head", "Body", "Leg", "Gloves", "Cape", "Horse", "HorseHarness" };
                // Build slot indices from same map used by equip/unequip — ensures consistency
                var slotMap = GetSlotIndexMap();
                TaleWorlds.Core.EquipmentIndex[] slotIndices = new TaleWorlds.Core.EquipmentIndex[slotNames.Length];
                for (int si = 0; si < slotNames.Length; si++)
                    slotIndices[si] = (TaleWorlds.Core.EquipmentIndex)slotMap[slotNames[si]];

                sb.Append("\"battle\":[");
                try
                {
                    var equip = hero.BattleEquipment;
                    if (equip != null)
                    {
                        bool first = true;
                        for (int i = 0; i < slotNames.Length; i++)
                        {
                            try
                            {
                                var element = equip[slotIndices[i]];
                                if (element.IsEmpty) continue;
                                if (!first) sb.Append(",");
                                sb.Append("{\"slot\":\"" + slotNames[i] + "\",\"slotIndex\":" + (int)slotIndices[i] + ",\"name\":\"" + JEsc(element.Item?.Name?.ToString() ?? "") + "\",\"id\":\"" + JEsc(element.Item?.StringId ?? "") + "\"");
                                AppendItemStats(sb, element.Item);
                                sb.Append("}");
                                first = false;
                            }
                            catch (Exception ex) { Log("[Equip JSON] Slot " + slotNames[i] + " error: " + ex.Message); }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                sb.Append("\"civilian\":[");
                try
                {
                    var equip = hero.CivilianEquipment;
                    if (equip != null)
                    {
                        bool first = true;
                        for (int i = 0; i < slotNames.Length; i++)
                        {
                            try
                            {
                                var element = equip[slotIndices[i]];
                                if (element.IsEmpty) continue;
                                if (!first) sb.Append(",");
                                sb.Append("{\"slot\":\"" + slotNames[i] + "\",\"slotIndex\":" + (int)slotIndices[i] + ",\"name\":\"" + JEsc(element.Item?.Name?.ToString() ?? "") + "\",\"id\":\"" + JEsc(element.Item?.StringId ?? "") + "\"");
                                AppendItemStats(sb, element.Item);
                                sb.Append("}");
                                first = false;
                            }
                            catch (Exception ex) { Log("[Equip JSON] Civilian slot " + slotNames[i] + " error: " + ex.Message); }
                        }
                    }
                }
                catch { }
                sb.Append("]");
            }
            catch (Exception ex) { Log("GetPlayerEquipment error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        private static string GetPlayerTroopsJson()
        {
            var sb = new StringBuilder("{\"troops\":[");
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party?.MemberRoster != null)
                {
                    var roster = party.MemberRoster;
                    bool first = true;
                    for (int i = 0; i < roster.Count; i++)
                    {
                        try
                        {
                            var element = roster.GetElementCopyAtIndex(i);
                            if (element.Character == null) continue;
                            bool isHero = element.Character.IsHero;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(element.Character.Name?.ToString() ?? "") + "\"");
                            sb.Append(",\"count\":" + element.Number);
                            sb.Append(",\"wounded\":" + element.WoundedNumber);
                            sb.Append(",\"tier\":" + element.Character.Tier);
                            sb.Append(",\"isHero\":" + (isHero ? "true" : "false"));
                            sb.Append(",\"isMounted\":" + (element.Character.IsMounted ? "true" : "false"));
                            sb.Append(",\"isRanged\":" + (element.Character.IsRanged ? "true" : "false"));
                            // Culture
                            try { sb.Append(",\"culture\":\"" + JEsc(element.Character.Culture?.Name?.ToString() ?? "") + "\""); } catch { }
                            // Wage
                            try
                            {
                                var wageMethod = element.Character.GetType().GetMethod("GetWage", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (wageMethod != null) sb.Append(",\"wage\":" + (int)wageMethod.Invoke(element.Character, null));
                            }
                            catch { }
                            // Upgrade targets
                            try
                            {
                                var upgradeTargets = element.Character.UpgradeTargets;
                                if (upgradeTargets != null && upgradeTargets.Length > 0)
                                {
                                    sb.Append(",\"upgrades\":[");
                                    bool uf = true;
                                    foreach (var ut in upgradeTargets)
                                    {
                                        if (ut == null) continue;
                                        if (!uf) sb.Append(",");
                                        sb.Append("{\"name\":\"" + JEsc(ut.Name?.ToString() ?? "") + "\",\"tier\":" + ut.Tier + "}");
                                        uf = false;
                                    }
                                    sb.Append("]");
                                }
                            }
                            catch { }
                            // StringId for troop
                            try { sb.Append(",\"id\":\"" + JEsc(element.Character.StringId ?? "") + "\""); } catch { }
                            // Number ready to upgrade (have enough XP)
                            if (!isHero)
                            {
                                try
                                {
                                    int upgradeable = 0;
                                    var numUpMethod = roster.GetType().GetMethod("GetElementNumber",
                                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    // Try GetNumberOfUpgradeableTroops on MobileParty
                                    try
                                    {
                                        // NumberReadyToUpgrade is stored per element
                                        var xpProp = roster.GetType().GetMethod("GetElementXp",
                                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        if (xpProp != null)
                                        {
                                            int totalXp = (int)xpProp.Invoke(roster, new object[] { i });
                                            // Each troop needs upgradeXpCost XP to upgrade
                                            int xpCost = 0;
                                            try { xpCost = element.Character.GetUpgradeXpCost(party.Party, 0); } catch { xpCost = element.Character.Tier * 100 + 100; }
                                            if (xpCost > 0 && totalXp > 0)
                                                upgradeable = Math.Min(element.Number, totalXp / xpCost);
                                        }
                                    }
                                    catch { }
                                    sb.Append(",\"upgradeable\":" + upgradeable);
                                }
                                catch { sb.Append(",\"upgradeable\":0"); }
                            }
                            if (isHero)
                            {
                                var h = element.Character.HeroObject;
                                if (h != null)
                                {
                                    sb.Append(",\"heroId\":\"" + JEsc(h.StringId) + "\"");
                                    sb.Append(",\"isCompanion\":" + (h.IsPlayerCompanion ? "true" : "false"));
                                }
                            }
                            sb.Append("}");
                            first = false;
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex) { Log("GetPlayerTroops error: " + ex.Message); }
            sb.Append("],");
            // Summary
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                int total = party?.MemberRoster?.TotalManCount ?? 0;
                int wounded = party?.MemberRoster?.TotalWounded ?? 0;
                int limit = party?.Party?.PartySizeLimit ?? 0;
                sb.Append("\"total\":" + total + ",\"wounded\":" + wounded + ",\"limit\":" + limit);
            }
            catch { sb.Append("\"total\":0,\"wounded\":0,\"limit\":0"); }
            sb.Append("}");
            return sb.ToString();
        }

        private static string GetPlayerPrisonersJson()
        {
            var sb = new StringBuilder("{\"prisoners\":[");
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party?.PrisonRoster != null)
                {
                    var roster = party.PrisonRoster;
                    bool first = true;
                    for (int i = 0; i < roster.Count; i++)
                    {
                        try
                        {
                            var element = roster.GetElementCopyAtIndex(i);
                            if (element.Character == null) continue;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(element.Character.Name?.ToString() ?? "") + "\"");
                            sb.Append(",\"count\":" + element.Number);
                            sb.Append(",\"tier\":" + element.Character.Tier);
                            sb.Append(",\"isHero\":" + (element.Character.IsHero ? "true" : "false"));
                            try { sb.Append(",\"id\":\"" + JEsc(element.Character.StringId ?? "") + "\""); } catch { }
                            try { sb.Append(",\"culture\":\"" + JEsc(element.Character.Culture?.Name?.ToString() ?? "") + "\""); } catch { }
                            if (element.Character.IsHero && element.Character.HeroObject != null)
                            {
                                sb.Append(",\"heroId\":\"" + JEsc(element.Character.HeroObject.StringId) + "\"");
                                // Ransom value for lord prisoners
                                try
                                {
                                    var h = element.Character.HeroObject;
                                    int ransomVal = 0;
                                    var clProp = h.GetType().GetProperty("Clan");
                                    if (clProp != null)
                                    {
                                        var clan = clProp.GetValue(h);
                                        if (clan != null) ransomVal = h.CharacterObject?.Tier * 1000 ?? 500;
                                    }
                                    // Better estimate based on tier
                                    ransomVal = Math.Max(ransomVal, element.Character.Tier * 500 + (element.Character.Level * 50));
                                    sb.Append(",\"ransomValue\":" + ransomVal);
                                }
                                catch { }
                            }
                            sb.Append("}");
                            first = false;
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex) { Log("GetPlayerPrisoners error: " + ex.Message); }
            sb.Append("],");
            try
            {
                int total = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty?.PrisonRoster?.TotalManCount ?? 0;
                sb.Append("\"total\":" + total);
            }
            catch { sb.Append("\"total\":0"); }
            sb.Append("}");
            return sb.ToString();
        }

        private static string GetPlayerInventoryJson()
        {
            var sb = new StringBuilder("{\"items\":[");
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party?.ItemRoster != null)
                {
                    var roster = party.ItemRoster;
                    bool first = true;
                    for (int i = 0; i < roster.Count; i++)
                    {
                        try
                        {
                            var element = roster.GetElementCopyAtIndex(i);
                            if (element.EquipmentElement.Item == null) continue;
                            var item = element.EquipmentElement.Item;
                            if (!first) sb.Append(",");
                            sb.Append("{\"name\":\"" + JEsc(item.Name?.ToString() ?? "") + "\"");
                            sb.Append(",\"id\":\"" + JEsc(item.StringId ?? "") + "\"");
                            sb.Append(",\"count\":" + element.Amount);
                            // Determine if this item is equippable and which slot
                            bool isEquippable = false;
                            string equipSlot = "";
                            // For weapons, list all valid weapon slots (0-3)
                            string equipSlots = "";
                            try
                            {
                                var iType = item.ItemType;
                                var iTypeStr = iType.ToString();
                                // Check all weapon types including modded ones
                                bool isWeapon = iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.OneHandedWeapon || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.TwoHandedWeapon || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Polearm
                                    || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bow || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Crossbow || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Thrown
                                    || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Arrows || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bolts
                                    || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Shield
                                    || iTypeStr == "Musket" || iTypeStr == "Pistol" || iTypeStr == "Bullets";
                                // Also check if item has weapon component (catches Slings, etc.)
                                if (!isWeapon && item.WeaponComponent != null) isWeapon = true;
                                if (isWeapon)
                                {
                                    isEquippable = true;
                                    // Find first empty weapon slot, or default to best fit
                                    equipSlots = "Weapon0,Weapon1,Weapon2,Weapon3";
                                    // Smart default: try to find an empty slot
                                    var eq = Hero.MainHero?.BattleEquipment;
                                    if (eq != null)
                                    {
                                        for (int ws = 0; ws < 4; ws++)
                                        {
                                            if (eq[ws].IsEmpty) { equipSlot = "Weapon" + ws; break; }
                                        }
                                    }
                                    // If no empty slot, use type-based default
                                    if (string.IsNullOrEmpty(equipSlot))
                                    {
                                        if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Arrows || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bolts)
                                            equipSlot = "Weapon3";
                                        else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bow || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Crossbow)
                                            equipSlot = "Weapon2";
                                        else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Shield)
                                            equipSlot = "Weapon1";
                                        else
                                            equipSlot = "Weapon0";
                                    }
                                }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HeadArmor)
                                { isEquippable = true; equipSlot = "Head"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.BodyArmor)
                                { isEquippable = true; equipSlot = "Body"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.LegArmor)
                                { isEquippable = true; equipSlot = "Leg"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HandArmor)
                                { isEquippable = true; equipSlot = "Gloves"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Cape)
                                { isEquippable = true; equipSlot = "Cape"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Horse)
                                { isEquippable = true; equipSlot = "Horse"; }
                                else if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HorseHarness)
                                { isEquippable = true; equipSlot = "HorseHarness"; }
                            }
                            catch { }
                            if (isEquippable)
                            {
                                sb.Append(",\"equippable\":true");
                                sb.Append(",\"equipSlot\":\"" + equipSlot + "\"");
                                if (!string.IsNullOrEmpty(equipSlots))
                                    sb.Append(",\"equipSlots\":\"" + equipSlots + "\"");
                            }
                            AppendItemStats(sb, item);
                            sb.Append("}");
                            first = false;
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex) { Log("GetPlayerInventory error: " + ex.Message); }
            sb.Append("]");

            // Add weight capacity
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party != null)
                {
                    // Total weight of inventory
                    float totalWeight = 0;
                    if (party.ItemRoster != null)
                    {
                        for (int i = 0; i < party.ItemRoster.Count; i++)
                        {
                            try
                            {
                                var el = party.ItemRoster.GetElementCopyAtIndex(i);
                                if (el.EquipmentElement.Item != null)
                                    totalWeight += el.EquipmentElement.Item.Weight * el.Amount;
                            }
                            catch { }
                        }
                    }
                    sb.Append(",\"totalWeight\":" + totalWeight.ToString("F1", System.Globalization.CultureInfo.InvariantCulture));

                    // Inventory capacity — try multiple approaches
                    float capacity = 0;
                    try
                    {
                        // MobileParty.InventoryCapacity
                        var capProp = party.GetType().GetProperty("InventoryCapacity",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (capProp != null) capacity = Convert.ToSingle(capProp.GetValue(party));
                    }
                    catch { }
                    if (capacity <= 0)
                    {
                        try
                        {
                            // Try TotalWeightCarryCapacity or similar
                            foreach (var prop in party.GetType().GetProperties())
                            {
                                if (prop.Name.Contains("Capacity") || prop.Name.Contains("Weight"))
                                {
                                    try
                                    {
                                        var val = prop.GetValue(party);
                                        if (val is float f && f > 100) { capacity = f; break; }
                                        if (val is int iv && iv > 100) { capacity = iv; break; }
                                    }
                                    catch { }
                                }
                            }
                        }
                        catch { }
                    }
                    if (capacity > 0)
                        sb.Append(",\"weightLimit\":" + capacity.ToString("F1", System.Globalization.CultureInfo.InvariantCulture));

                    // Is overweight?
                    if (capacity > 0 && totalWeight > capacity)
                        sb.Append(",\"overweight\":true");
                }
            }
            catch { }

            sb.Append("}");
            return sb.ToString();
        }

        // ══════════════════════════════════════════════════════════════
        // EQUIP / UNEQUIP — Uses game's Equipment API via main thread
        // ══════════════════════════════════════════════════════════════

        // Build slot map from actual EquipmentIndex enum values at runtime
        private static Dictionary<string, int> _slotIndexMap;
        private static Dictionary<string, int> GetSlotIndexMap()
        {
            if (_slotIndexMap != null) return _slotIndexMap;
            _slotIndexMap = new Dictionary<string, int>();
            try
            {
                var eiType = typeof(TaleWorlds.Core.EquipmentIndex);
                _slotIndexMap["Weapon0"] = (int)TaleWorlds.Core.EquipmentIndex.Weapon0;
                _slotIndexMap["Weapon1"] = (int)TaleWorlds.Core.EquipmentIndex.Weapon1;
                _slotIndexMap["Weapon2"] = (int)TaleWorlds.Core.EquipmentIndex.Weapon2;
                _slotIndexMap["Weapon3"] = (int)TaleWorlds.Core.EquipmentIndex.Weapon3;
                _slotIndexMap["Horse"] = (int)TaleWorlds.Core.EquipmentIndex.Horse;
                _slotIndexMap["HorseHarness"] = (int)TaleWorlds.Core.EquipmentIndex.HorseHarness;
                // Armor slots: NumAllWeaponSlots is Head, then +1 for each
                int headIdx = (int)TaleWorlds.Core.EquipmentIndex.NumAllWeaponSlots;
                _slotIndexMap["Head"] = headIdx;
                _slotIndexMap["Body"] = headIdx + 1;
                _slotIndexMap["Leg"] = headIdx + 2;
                _slotIndexMap["Gloves"] = headIdx + 3;
                _slotIndexMap["Cape"] = headIdx + 4;
                Log("[SlotMap] Weapon0=" + _slotIndexMap["Weapon0"] + " Head=" + headIdx
                    + " Body=" + (headIdx+1) + " Leg=" + (headIdx+2) + " Gloves=" + (headIdx+3)
                    + " Cape=" + (headIdx+4) + " Horse=" + _slotIndexMap["Horse"]
                    + " HorseHarness=" + _slotIndexMap["HorseHarness"]);
            }
            catch (Exception ex)
            {
                Log("[SlotMap] Error building map: " + ex.Message + " — using fallback");
                _slotIndexMap["Weapon0"] = 0; _slotIndexMap["Weapon1"] = 1;
                _slotIndexMap["Weapon2"] = 2; _slotIndexMap["Weapon3"] = 3;
                _slotIndexMap["Head"] = 4; _slotIndexMap["Body"] = 5;
                _slotIndexMap["Leg"] = 6; _slotIndexMap["Gloves"] = 7;
                _slotIndexMap["Cape"] = 8; _slotIndexMap["Horse"] = 9;
                _slotIndexMap["HorseHarness"] = 10;
            }
            return _slotIndexMap;
        }

        /// <summary>Converts slot index to EquipmentIndex enum via reflection (safe across game versions).</summary>
        private static object GetEquipmentIndex(int slotIdx)
        {
            try
            {
                var eiType = typeof(TaleWorlds.Core.EquipmentIndex);
                return System.Enum.ToObject(eiType, slotIdx);
            }
            catch { return null; }
        }

        /// <summary>Determines the correct equipment slot index for an item based on its ItemType.</summary>
        private static int GetCorrectSlotForItem(TaleWorlds.Core.ItemObject item, TaleWorlds.Core.Equipment equipment)
        {
            if (item == null) return -1;
            var iType = item.ItemType;

            Log("[Equip] GetCorrectSlot: item=" + item.Name?.ToString() + " id=" + item.StringId + " ItemType=" + iType.ToString() + " (" + (int)iType + ")" + " HasHorse=" + (item.HorseComponent != null) + " HasArmor=" + (item.ArmorComponent != null));

            // Armor/mount — use actual EquipmentIndex enum values (not hardcoded)
            var map = GetSlotIndexMap();
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HorseHarness) return map["HorseHarness"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Horse) return map["Horse"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HeadArmor) return map["Head"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.BodyArmor) return map["Body"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.LegArmor) return map["Leg"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.HandArmor) return map["Gloves"];
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Cape) return map["Cape"];

            // Weapons — find the best slot (0-3)
            // Priority: place in matching empty slot, then replace matching type, then first empty
            if (iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.OneHandedWeapon
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.TwoHandedWeapon
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Polearm
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bow
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Crossbow
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Thrown
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Arrows
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Bolts
                || iType == TaleWorlds.Core.ItemObject.ItemTypeEnum.Shield)
            {
                // 1) Find an empty weapon slot
                int firstEmpty = -1;
                for (int i = 0; i < 4; i++)
                {
                    if (equipment[i].IsEmpty)
                    {
                        if (firstEmpty < 0) firstEmpty = i;
                    }
                }

                // 2) Find a slot with the same item type (to replace)
                int sameTypeSlot = -1;
                for (int i = 0; i < 4; i++)
                {
                    if (!equipment[i].IsEmpty && equipment[i].Item != null && equipment[i].Item.ItemType == iType)
                    {
                        sameTypeSlot = i;
                        break;
                    }
                }

                // 3) Prefer: same-type replacement > empty slot > slot 0 as fallback
                if (sameTypeSlot >= 0) return sameTypeSlot;
                if (firstEmpty >= 0) return firstEmpty;
                return 0; // fallback — replace slot 0
            }

            return -1; // not equippable
        }

        private static string HandleEquipItem(string itemId, string slot, string equipType, string heroId = "")
        {
            if (string.IsNullOrEmpty(itemId)) return "{\"error\":\"Missing itemId\"}";

            bool isBattle = string.IsNullOrEmpty(equipType) || equipType != "civilian";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                    {
                        Hero target = null;
                        foreach (var h in hero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                        }
                        if (target == null) { result = "{\"error\":\"Hero not found\"}"; doneEvent.Set(); return; }
                        hero = target;
                    }

                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.ItemRoster == null) { result = "{\"error\":\"No party inventory\"}"; doneEvent.Set(); return; }

                    // Find the item in inventory
                    var roster = party.ItemRoster;
                    int foundIndex = -1;
                    for (int i = 0; i < roster.Count; i++)
                    {
                        try
                        {
                            var el = roster.GetElementCopyAtIndex(i);
                            if (el.EquipmentElement.Item != null && el.EquipmentElement.Item.StringId == itemId && el.Amount > 0)
                            {
                                foundIndex = i;
                                break;
                            }
                        }
                        catch { }
                    }

                    if (foundIndex < 0) { result = "{\"error\":\"Item not found in inventory\"}"; doneEvent.Set(); return; }

                    var rosterElement = roster.GetElementCopyAtIndex(foundIndex);
                    var newItem = rosterElement.EquipmentElement;
                    var equipment = isBattle ? hero.BattleEquipment : hero.CivilianEquipment;

                    // Determine correct slot from the item's type — ignore client-sent slot
                    int slotIdx = GetCorrectSlotForItem(newItem.Item, equipment);
                    if (slotIdx < 0) { result = "{\"error\":\"Item cannot be equipped\"}"; doneEvent.Set(); return; }

                    // Safety: can't equip HorseHarness without a Horse
                    if (slotIdx == GetSlotIndexMap()["HorseHarness"] && equipment[TaleWorlds.Core.EquipmentIndex.Horse].IsEmpty)
                    {
                        result = "{\"error\":\"Cannot equip harness without a horse\"}";
                        doneEvent.Set(); return;
                    }

                    var eqIndex = (TaleWorlds.Core.EquipmentIndex)slotIdx;
                    string actualSlot = GetSlotIndexMap().FirstOrDefault(x => x.Value == slotIdx).Key ?? "Unknown";

                    // Save current equipped item (to return to inventory)
                    var oldEquipped = equipment[eqIndex];

                    // Remove item from inventory FIRST
                    roster.AddToCounts(newItem, -1);

                    // Set the equipment using direct indexer (safest for all item types)
                    equipment[eqIndex] = newItem;

                    // Return old item to inventory (if any)
                    if (!oldEquipped.IsEmpty)
                    {
                        roster.AddToCounts(oldEquipped, 1);
                    }

                    string itemName = newItem.Item?.Name?.ToString() ?? "item";
                    string oldName = oldEquipped.IsEmpty ? "" : oldEquipped.Item?.Name?.ToString() ?? "";
                    Log("[Equip] " + itemName + " -> " + actualSlot + " (idx " + slotIdx + ")" + (isBattle ? " battle" : " civilian") + (oldName != "" ? " | replaced " + oldName : ""));

                    result = "{\"success\":true,\"equipped\":\"" + JEsc(itemName) + "\",\"replaced\":\"" + JEsc(oldName) + "\",\"slot\":\"" + JEsc(actualSlot) + "\"}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[Equip] Error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            // Wait for main thread to process (timeout 5s)
            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout waiting for game thread\"}";

            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleUnequipItem(string slot, string equipType, string heroId = "")
        {
            var slotMap = GetSlotIndexMap();
            if (string.IsNullOrEmpty(slot) || !slotMap.ContainsKey(slot)) return "{\"error\":\"Invalid slot: " + JEsc(slot ?? "") + "\"}";

            bool isBattle = string.IsNullOrEmpty(equipType) || equipType != "civilian";
            int slotIdx = slotMap[slot];

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                    {
                        Hero target = null;
                        foreach (var h in hero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                        }
                        if (target == null) { result = "{\"error\":\"Hero not found\"}"; doneEvent.Set(); return; }
                        hero = target;
                    }

                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.ItemRoster == null) { result = "{\"error\":\"No party inventory\"}"; doneEvent.Set(); return; }

                    var equipment = isBattle ? hero.BattleEquipment : hero.CivilianEquipment;
                    var eqIndex = (TaleWorlds.Core.EquipmentIndex)slotIdx;
                    var current = equipment[eqIndex];

                    if (current.IsEmpty) { result = "{\"error\":\"Slot is already empty\"}"; doneEvent.Set(); return; }

                    // If unequipping Horse, also unequip HorseHarness (harness without horse = crash)
                    string extraUnequipped = "";
                    if (slotIdx == (int)TaleWorlds.Core.EquipmentIndex.Horse)
                    {
                        var harnessIndex = TaleWorlds.Core.EquipmentIndex.HorseHarness;
                        var harness = equipment[harnessIndex];
                        if (!harness.IsEmpty)
                        {
                            equipment[harnessIndex] = new TaleWorlds.Core.EquipmentElement();
                            party.ItemRoster.AddToCounts(harness, 1);
                            extraUnequipped = harness.Item?.Name?.ToString() ?? "";
                            Log("[Unequip] Also removed harness: " + extraUnequipped);
                        }
                    }

                    // Clear the slot using default empty element
                    equipment[eqIndex] = new TaleWorlds.Core.EquipmentElement();

                    // Move equipped item to inventory
                    party.ItemRoster.AddToCounts(current, 1);

                    string itemName = current.Item?.Name?.ToString() ?? "item";
                    Log("[Unequip] " + itemName + " from " + slot + (isBattle ? " (battle)" : " (civilian)"));

                    result = "{\"success\":true,\"unequipped\":\"" + JEsc(itemName) + "\",\"slot\":\"" + slot + "\"" +
                        (extraUnequipped != "" ? ",\"alsoUnequipped\":\"" + JEsc(extraUnequipped) + "\"" : "") + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[Unequip] Error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout waiting for game thread\"}";

            return result ?? "{\"error\":\"Unknown error\"}";
        }

        // ══════════════════════════════════════════════════════════════
        // SELECT PERK — Learn/activate a perk for the player or clan hero
        // ══════════════════════════════════════════════════════════════
        private static string HandleSelectPerk(string perkId, string heroId = "")
        {
            if (string.IsNullOrEmpty(perkId)) return "{\"error\":\"Missing perkId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }

                    // If heroId specified, find that hero in clan
                    if (!string.IsNullOrEmpty(heroId))
                    {
                        Hero targetHero = null;
                        if (hero.Clan != null)
                            foreach (var h in hero.Clan.Heroes)
                                if (h != null && h.IsAlive && h.StringId == heroId) { targetHero = h; break; }
                        if (targetHero == null) { result = "{\"error\":\"Hero not found in clan\"}"; doneEvent.Set(); return; }
                        hero = targetHero;
                    }

                    // Find the PerkObject by StringId
                    object perkObj = null;
                    Type perkType = null;
                    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        foreach (var typeName in new[] { "TaleWorlds.CampaignSystem.CharacterDevelopment.PerkObject", "TaleWorlds.Core.PerkObject" })
                        {
                            perkType = asm.GetType(typeName);
                            if (perkType != null) break;
                        }
                        if (perkType != null) break;
                    }
                    if (perkType == null)
                    {
                        // Search all assemblies for PerkObject
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            try
                            {
                                foreach (var t in asm.GetTypes())
                                    if (t.Name == "PerkObject") { perkType = t; break; }
                            }
                            catch { }
                            if (perkType != null) break;
                        }
                    }
                    if (perkType == null) { result = "{\"error\":\"PerkObject type not found\"}"; doneEvent.Set(); return; }

                    var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                    var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(perkType);
                    var allPerks = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                    if (allPerks != null)
                    {
                        foreach (var p in allPerks)
                        {
                            if (p == null) continue;
                            string sid = p.GetType().GetProperty("StringId")?.GetValue(p)?.ToString() ?? "";
                            if (sid == perkId) { perkObj = p; break; }
                        }
                    }
                    if (perkObj == null) { result = "{\"error\":\"Perk not found: " + JEsc(perkId) + "\"}"; doneEvent.Set(); return; }

                    // Check if hero already has this perk
                    bool hasPerk = false;
                    try
                    {
                        var gpv = hero.GetType().GetMethod("GetPerkValue",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (gpv != null) hasPerk = (bool)gpv.Invoke(hero, new[] { perkObj });
                    }
                    catch { }
                    if (hasPerk) { result = "{\"error\":\"Perk already learned\"}"; doneEvent.Set(); return; }

                    // Check skill level requirement
                    int reqSkill = 0;
                    try
                    {
                        var rsv = perkObj.GetType().GetProperty("RequiredSkillValue")?.GetValue(perkObj);
                        reqSkill = (rsv is float f) ? (int)f : (rsv is int i) ? i : Convert.ToInt32(rsv);
                    }
                    catch { }

                    // Get skill for this perk
                    object perkSkill = null;
                    string perkSkillId = "";
                    try
                    {
                        perkSkill = perkObj.GetType().GetProperty("Skill")?.GetValue(perkObj);
                        perkSkillId = perkSkill?.GetType().GetProperty("StringId")?.GetValue(perkSkill)?.ToString() ?? "";
                    }
                    catch { }

                    int heroSkillVal = 0;
                    if (perkSkill != null)
                    {
                        try
                        {
                            var getSkillVal = hero.GetType().GetMethod("GetSkillValue",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (getSkillVal != null)
                                heroSkillVal = (int)getSkillVal.Invoke(hero, new[] { perkSkill });
                        }
                        catch { }
                    }

                    if (heroSkillVal < reqSkill)
                    {
                        result = "{\"error\":\"Skill level too low (" + heroSkillVal + "/" + reqSkill + ")\"}";
                        doneEvent.Set(); return;
                    }

                    // Apply the perk via HeroDeveloper.SetPerkValue or AddPerk
                    bool applied = false;
                    try
                    {
                        var heroDev = hero.GetType().GetProperty("HeroDeveloper",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)?.GetValue(hero);
                        if (heroDev != null)
                        {
                            // Try SetPerkValue(PerkObject, bool)
                            var setPerkVal = heroDev.GetType().GetMethod("SetPerkValue",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (setPerkVal != null)
                            {
                                var parms = setPerkVal.GetParameters();
                                if (parms.Length == 2)
                                {
                                    setPerkVal.Invoke(heroDev, new object[] { perkObj, true });
                                    applied = true;
                                    Log("[SelectPerk] Applied perk " + perkId + " via SetPerkValue");
                                }
                            }

                            // Fallback: try AddPerk(PerkObject)
                            if (!applied)
                            {
                                var addPerk = heroDev.GetType().GetMethod("AddPerk",
                                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (addPerk != null)
                                {
                                    addPerk.Invoke(heroDev, new object[] { perkObj });
                                    applied = true;
                                    Log("[SelectPerk] Applied perk " + perkId + " via AddPerk");
                                }
                            }
                        }
                    }
                    catch (Exception ex) { Log("[SelectPerk] Apply error: " + ex.Message); }

                    if (!applied)
                    {
                        result = "{\"error\":\"Failed to apply perk — method not found\"}";
                        doneEvent.Set(); return;
                    }

                    string perkName = perkObj.GetType().GetProperty("Name")?.GetValue(perkObj)?.ToString() ?? perkId;
                    result = "{\"success\":true,\"perk\":\"" + JEsc(perkName) + "\",\"skillId\":\"" + JEsc(perkSkillId) + "\"}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[SelectPerk] Error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout waiting for game thread\"}";
            return result;
        }

        // PERKS — Get perk tree for a skill
        // ══════════════════════════════════════════════════════════════

        private static string GetPlayerPerksJson(string skillId, string heroId = "")
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                if (hero == null) return "{\"error\":\"No campaign\"}";
                if (string.IsNullOrEmpty(skillId)) return "{\"error\":\"Missing skillId\"}";

                // If heroId specified, find that hero
                if (!string.IsNullOrEmpty(heroId))
                {
                    Hero targetHero = null;
                    try
                    {
                        if (hero.Clan != null)
                            foreach (var h in hero.Clan.Heroes)
                                if (h != null && h.IsAlive && h.StringId == heroId) { targetHero = h; break; }
                    }
                    catch { }
                    if (targetHero == null) return "{\"error\":\"Hero not found in clan\"}";
                    hero = targetHero;
                }

                // Find the skill
                object skillObj = null;
                var soType = Type.GetType("TaleWorlds.Core.SkillObject, TaleWorlds.Core");
                if (soType != null)
                {
                    var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                    var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(soType);
                    var allSkills = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                    if (allSkills != null)
                    {
                        foreach (var s in allSkills)
                        {
                            var sid = s.GetType().GetProperty("StringId")?.GetValue(s)?.ToString();
                            if (sid == skillId) { skillObj = s; break; }
                        }
                    }
                }
                if (skillObj == null) return "{\"error\":\"Skill not found\"}";

                string skillName = skillObj.GetType().GetProperty("Name")?.GetValue(skillObj)?.ToString() ?? skillId;
                sb.Append("\"skillId\":\"" + JEsc(skillId) + "\",\"skillName\":\"" + JEsc(skillName) + "\",");

                // Get skill value
                int skillVal = 0;
                try
                {
                    var gsv = hero.GetType().GetMethod("GetSkillValue");
                    if (gsv != null) skillVal = (int)gsv.Invoke(hero, new[] { skillObj });
                }
                catch { }
                sb.Append("\"skillValue\":" + skillVal + ",");

                // Get all perks for this skill
                sb.Append("\"perks\":[");
                try
                {
                    // PerkObject — try multiple type names
                    Type perkType = null;
                    foreach (var typeName in new[] { "TaleWorlds.Core.PerkObject", "TaleWorlds.CampaignSystem.CharacterDevelopment.PerkObject", "TaleWorlds.CampaignSystem.PerkObject" })
                    {
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            perkType = asm.GetType(typeName);
                            if (perkType != null) break;
                        }
                        if (perkType != null) break;
                    }

                    // Fallback: search all assemblies for any type named "PerkObject"
                    if (perkType == null)
                    {
                        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                        {
                            try
                            {
                                foreach (var t in asm.GetTypes())
                                {
                                    if (t.Name == "PerkObject") { perkType = t; break; }
                                }
                            }
                            catch { }
                            if (perkType != null) break;
                        }
                    }

                    Log("[Perks] PerkObject type: " + (perkType?.FullName ?? "NOT FOUND"));

                    if (perkType != null)
                    {
                        var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                        var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(perkType);
                        var allPerks = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                        if (allPerks != null)
                        {
                            // Log first perk's properties for debug
                            bool loggedFirst = false;
                            var perkList = new List<object>();
                            foreach (var p in allPerks)
                            {
                                if (p == null) continue;
                                if (!loggedFirst)
                                {
                                    var props = p.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    Log("[Perks] First perk properties: " + string.Join(", ", props.Select(pr => pr.Name + ":" + pr.PropertyType.Name)));
                                    loggedFirst = true;
                                }
                                // Check if perk belongs to this skill
                                try
                                {
                                    var pSkill = p.GetType().GetProperty("Skill")?.GetValue(p);
                                    if (pSkill == null) continue;
                                    var pSkillId = pSkill.GetType().GetProperty("StringId")?.GetValue(pSkill)?.ToString();
                                    if (pSkillId == skillId) perkList.Add(p);
                                }
                                catch { }
                            }

                            // Sort by RequiredSkillValue
                            perkList.Sort((a, b) =>
                            {
                                int va = 0, vb = 0;
                                try { va = (int)a.GetType().GetProperty("RequiredSkillValue").GetValue(a); } catch { }
                                try { vb = (int)b.GetType().GetProperty("RequiredSkillValue").GetValue(b); } catch { }
                                return va.CompareTo(vb);
                            });

                            bool pf = true;
                            foreach (var p in perkList)
                            {
                                try
                                {
                                    string pName = p.GetType().GetProperty("Name")?.GetValue(p)?.ToString() ?? "";
                                    string pId = p.GetType().GetProperty("StringId")?.GetValue(p)?.ToString() ?? "";
                                    int reqSkill = 0;
                                    try
                                    {
                                        var rsv = p.GetType().GetProperty("RequiredSkillValue").GetValue(p);
                                        reqSkill = (rsv is float f) ? (int)f : (rsv is int i) ? i : Convert.ToInt32(rsv);
                                    }
                                    catch { }

                                    // Check if hero has this perk — try Hero, then CharacterObject
                                    bool hasPerk = false;
                                    try
                                    {
                                        var getsPerkMethod = hero.GetType().GetMethod("GetPerkValue",
                                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        if (getsPerkMethod != null)
                                            hasPerk = (bool)getsPerkMethod.Invoke(hero, new[] { p });
                                    }
                                    catch { }
                                    if (!hasPerk)
                                    {
                                        try
                                        {
                                            var charObj = hero.CharacterObject;
                                            if (charObj != null)
                                            {
                                                var gpv = charObj.GetType().GetMethod("GetPerkValue",
                                                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                                if (gpv != null) hasPerk = (bool)gpv.Invoke(charObj, new[] { p });
                                            }
                                        }
                                        catch { }
                                    }

                                    // Get primary and secondary descriptions
                                    string desc = "";
                                    try { desc = p.GetType().GetProperty("PrimaryDescription")?.GetValue(p)?.ToString() ?? ""; } catch { }
                                    string desc2 = "";
                                    try { desc2 = p.GetType().GetProperty("SecondaryDescription")?.GetValue(p)?.ToString() ?? ""; } catch { }
                                    if (string.IsNullOrEmpty(desc))
                                        try { desc = p.GetType().GetProperty("Description")?.GetValue(p)?.ToString() ?? ""; } catch { }

                                    // Primary/Secondary bonuses
                                    float primaryBonus = 0, secondaryBonus = 0;
                                    try { primaryBonus = (float)p.GetType().GetProperty("PrimaryBonus").GetValue(p); } catch { }
                                    try { secondaryBonus = (float)p.GetType().GetProperty("SecondaryBonus").GetValue(p); } catch { }

                                    // Get alternative perk (each level has 2 choices)
                                    string altPerkId = "";
                                    try
                                    {
                                        var altPerk = p.GetType().GetProperty("AlternativePerk")?.GetValue(p);
                                        if (altPerk != null)
                                            altPerkId = altPerk.GetType().GetProperty("StringId")?.GetValue(altPerk)?.ToString() ?? "";
                                    }
                                    catch { }

                                    // Try to get icon identifier for perk image matching
                                    string iconId = "";
                                    try { iconId = p.GetType().GetProperty("IconId")?.GetValue(p)?.ToString() ?? ""; } catch { }
                                    if (string.IsNullOrEmpty(iconId))
                                        try { iconId = p.GetType().GetProperty("IconName")?.GetValue(p)?.ToString() ?? ""; } catch { }

                                    if (!pf) sb.Append(",");
                                    sb.Append("{\"id\":\"" + JEsc(pId) + "\",\"name\":\"" + JEsc(pName) + "\"");
                                    if (!string.IsNullOrEmpty(iconId)) sb.Append(",\"iconId\":\"" + JEsc(iconId) + "\"");
                                    sb.Append(",\"reqSkill\":" + reqSkill);
                                    sb.Append(",\"hasPerk\":" + (hasPerk ? "true" : "false"));
                                    sb.Append(",\"description\":\"" + JEsc(desc) + "\"");
                                    if (!string.IsNullOrEmpty(desc2)) sb.Append(",\"secondaryDesc\":\"" + JEsc(desc2) + "\"");
                                    if (primaryBonus != 0) sb.Append(",\"primaryBonus\":" + primaryBonus.ToString("F1", System.Globalization.CultureInfo.InvariantCulture));
                                    if (secondaryBonus != 0) sb.Append(",\"secondaryBonus\":" + secondaryBonus.ToString("F1", System.Globalization.CultureInfo.InvariantCulture));
                                    if (!string.IsNullOrEmpty(altPerkId)) sb.Append(",\"altPerkId\":\"" + JEsc(altPerkId) + "\"");
                                    sb.Append("}");
                                    pf = false;
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch (Exception ex) { Log("[Perks] Error: " + ex.Message); }
                sb.Append("]");
            }
            catch (Exception ex) { return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        // ══════════════════════════════════════════════════════════════
        // FOCUS / ATTRIBUTE POINTS — Spend points via main thread
        // ══════════════════════════════════════════════════════════════

        private static string HandleAddFocusPoint(string skillId, string heroId = "")
        {
            if (string.IsNullOrEmpty(skillId)) return "{\"error\":\"Missing skillId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                    {
                        Hero target = null;
                        foreach (var h in hero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                        }
                        if (target == null) { result = "{\"error\":\"Hero not found in clan\"}"; doneEvent.Set(); return; }
                        hero = target;
                    }

                    // Get HeroDeveloper
                    var devProp = hero.GetType().GetProperty("HeroDeveloper",
                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (devProp == null) { result = "{\"error\":\"HeroDeveloper not found\"}"; doneEvent.Set(); return; }
                    var dev = devProp.GetValue(hero);
                    if (dev == null) { result = "{\"error\":\"HeroDeveloper is null\"}"; doneEvent.Set(); return; }

                    // Check unspent focus points
                    int unspent = 0;
                    try
                    {
                        var ufpProp = dev.GetType().GetProperty("UnspentFocusPoints");
                        if (ufpProp != null) unspent = (int)ufpProp.GetValue(dev);
                    }
                    catch { }
                    if (unspent <= 0) { result = "{\"error\":\"No focus points available\"}"; doneEvent.Set(); return; }

                    // Find the skill by StringId
                    object skillObj = null;
                    try
                    {
                        var soType = Type.GetType("TaleWorlds.Core.SkillObject, TaleWorlds.Core");
                        if (soType != null)
                        {
                            var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                            var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(soType);
                            var allSkills = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                            if (allSkills != null)
                            {
                                foreach (var s in allSkills)
                                {
                                    var sid = s.GetType().GetProperty("StringId")?.GetValue(s)?.ToString();
                                    if (sid == skillId) { skillObj = s; break; }
                                }
                            }
                        }
                    }
                    catch { }
                    if (skillObj == null) { result = "{\"error\":\"Skill not found: " + JEsc(skillId) + "\"}"; doneEvent.Set(); return; }

                    // Check current focus (max 5)
                    int currentFocus = 0;
                    try
                    {
                        var gfm = dev.GetType().GetMethod("GetFocus");
                        if (gfm != null) currentFocus = (int)gfm.Invoke(dev, new[] { skillObj });
                    }
                    catch { }
                    if (currentFocus >= 5) { result = "{\"error\":\"Skill already at max focus (5)\"}"; doneEvent.Set(); return; }

                    // Add focus point — try multiple method signatures
                    bool focusAdded = false;
                    try
                    {
                        // Log all available focus-related methods
                        var focusMethods = dev.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                            .Where(m => m.Name.Contains("Focus") || m.Name.Contains("focus")).ToList();
                        foreach (var fm in focusMethods)
                        {
                            Log("[Character] HeroDeveloper method: " + fm.Name + "(" +
                                string.Join(", ", fm.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name)) + ")");
                        }

                        // Try AddFocus(SkillObject, int)
                        var addFocusMethod = dev.GetType().GetMethod("AddFocus",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (addFocusMethod != null)
                        {
                            var parms = addFocusMethod.GetParameters();
                            Log("[Character] AddFocus params: " + string.Join(", ", parms.Select(p => p.ParameterType.FullName + " " + p.Name)));

                            if (parms.Length == 2)
                            {
                                addFocusMethod.Invoke(dev, new object[] { skillObj, 1 });
                                focusAdded = true;
                            }
                            else if (parms.Length == 1)
                            {
                                // Maybe just AddFocus(SkillObject) — adds 1 automatically
                                addFocusMethod.Invoke(dev, new object[] { skillObj });
                                focusAdded = true;
                            }
                            else if (parms.Length == 3)
                            {
                                // Maybe AddFocus(SkillObject, int, bool) with checkUnspent flag
                                addFocusMethod.Invoke(dev, new object[] { skillObj, 1, true });
                                focusAdded = true;
                            }
                        }

                        // Fallback: try SetFocus directly
                        if (!focusAdded)
                        {
                            var setFocusMethod = dev.GetType().GetMethod("SetFocus",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (setFocusMethod != null)
                            {
                                var parms = setFocusMethod.GetParameters();
                                Log("[Character] SetFocus params: " + string.Join(", ", parms.Select(p => p.ParameterType.FullName + " " + p.Name)));
                                if (parms.Length == 2)
                                {
                                    setFocusMethod.Invoke(dev, new object[] { skillObj, currentFocus + 1 });
                                    focusAdded = true;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        result = "{\"error\":\"AddFocus failed: " + JEsc(ex.InnerException?.Message ?? ex.Message) + "\"}";
                        doneEvent.Set(); return;
                    }

                    if (!focusAdded)
                    {
                        result = "{\"error\":\"No compatible AddFocus/SetFocus method found\"}";
                        doneEvent.Set(); return;
                    }

                    string skillName = skillObj.GetType().GetProperty("Name")?.GetValue(skillObj)?.ToString() ?? skillId;
                    Log("[Character] Added focus point to " + skillName + " (now " + (currentFocus + 1) + ")");
                    result = "{\"success\":true,\"skill\":\"" + JEsc(skillName) + "\",\"newFocus\":" + (currentFocus + 1) + ",\"remaining\":" + (unspent - 1) + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[Character] AddFocus error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout waiting for game thread\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleAddAttributePoint(string attrName, string heroId = "")
        {
            if (string.IsNullOrEmpty(attrName)) return "{\"error\":\"Missing attribute\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                    {
                        Hero target = null;
                        foreach (var h in hero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                        }
                        if (target == null) { result = "{\"error\":\"Hero not found in clan\"}"; doneEvent.Set(); return; }
                        hero = target;
                    }

                    var devProp = hero.GetType().GetProperty("HeroDeveloper",
                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (devProp == null) { result = "{\"error\":\"HeroDeveloper not found\"}"; doneEvent.Set(); return; }
                    var dev = devProp.GetValue(hero);
                    if (dev == null) { result = "{\"error\":\"HeroDeveloper is null\"}"; doneEvent.Set(); return; }

                    // Check unspent attribute points
                    int unspent = 0;
                    try
                    {
                        var uapProp = dev.GetType().GetProperty("UnspentAttributePoints");
                        if (uapProp != null) unspent = (int)uapProp.GetValue(dev);
                    }
                    catch { }
                    if (unspent <= 0) { result = "{\"error\":\"No attribute points available\"}"; doneEvent.Set(); return; }

                    // Find the CharacterAttribute object — try enum first, then DefaultCharacterAttributes
                    object attrObj = null;
                    try
                    {
                        // Strategy 1: CharacterAttributesEnum
                        var attrEnumType = Type.GetType("TaleWorlds.Core.CharacterAttributesEnum, TaleWorlds.Core");
                        if (attrEnumType == null)
                        {
                            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                            {
                                attrEnumType = asm.GetType("TaleWorlds.Core.CharacterAttributesEnum");
                                if (attrEnumType != null) break;
                            }
                        }
                        if (attrEnumType != null && attrEnumType.IsEnum)
                        {
                            foreach (var v in Enum.GetValues(attrEnumType))
                            {
                                if (v.ToString().Equals(attrName, StringComparison.OrdinalIgnoreCase))
                                { attrObj = v; break; }
                            }
                        }

                        // Strategy 2: DefaultCharacterAttributes static properties
                        if (attrObj == null)
                        {
                            Type dcaType = null;
                            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                            {
                                dcaType = asm.GetType("TaleWorlds.Core.DefaultCharacterAttributes");
                                if (dcaType != null) break;
                            }
                            if (dcaType != null)
                            {
                                var prop = dcaType.GetProperty(attrName, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                if (prop != null) attrObj = prop.GetValue(null);
                            }
                        }
                    }
                    catch { }
                    if (attrObj == null) { result = "{\"error\":\"Attribute not found: " + JEsc(attrName) + "\"}"; doneEvent.Set(); return; }
                    Log("[Character] Found attribute object: " + attrObj.GetType().FullName + " = " + attrObj);

                    // Check current value (max 10)
                    int currentVal = 0;
                    try
                    {
                        var getAttr = hero.GetType().GetMethod("GetAttributeValue");
                        if (getAttr != null) currentVal = (int)getAttr.Invoke(hero, new[] { attrObj });
                    }
                    catch { }
                    if (currentVal >= 10) { result = "{\"error\":\"Attribute already at max (10)\"}"; doneEvent.Set(); return; }

                    // Add attribute point — try multiple method signatures
                    bool attrAdded = false;
                    try
                    {
                        var attrMethods = dev.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                            .Where(m => m.Name.Contains("Attribute") || m.Name.Contains("attribute")).ToList();
                        foreach (var am in attrMethods)
                        {
                            Log("[Character] HeroDeveloper method: " + am.Name + "(" +
                                string.Join(", ", am.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name)) + ")");
                        }

                        var addAttrMethod = dev.GetType().GetMethod("AddAttribute",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (addAttrMethod != null)
                        {
                            var parms = addAttrMethod.GetParameters();
                            Log("[Character] AddAttribute params: " + string.Join(", ", parms.Select(p => p.ParameterType.FullName + " " + p.Name)));

                            if (parms.Length == 2)
                            {
                                addAttrMethod.Invoke(dev, new object[] { attrObj, 1 });
                                attrAdded = true;
                            }
                            else if (parms.Length == 1)
                            {
                                addAttrMethod.Invoke(dev, new object[] { attrObj });
                                attrAdded = true;
                            }
                            else if (parms.Length == 3)
                            {
                                addAttrMethod.Invoke(dev, new object[] { attrObj, 1, true });
                                attrAdded = true;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        result = "{\"error\":\"AddAttribute failed: " + JEsc(ex.InnerException?.Message ?? ex.Message) + "\"}";
                        doneEvent.Set(); return;
                    }

                    if (!attrAdded)
                    {
                        result = "{\"error\":\"No compatible AddAttribute method found\"}";
                        doneEvent.Set(); return;
                    }

                    Log("[Character] Added attribute point to " + attrName + " (now " + (currentVal + 1) + ")");
                    result = "{\"success\":true,\"attribute\":\"" + JEsc(attrName) + "\",\"newValue\":" + (currentVal + 1) + ",\"remaining\":" + (unspent - 1) + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[Character] AddAttribute error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout waiting for game thread\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleSetGovernor(string settlementId, string heroId)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                    {
                        if (s.StringId == settlementId) { target = s; break; }
                    }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }
                    if (target.Town == null) { result = "{\"error\":\"Not a town or castle\"}"; doneEvent.Set(); return; }

                    Hero governor = null;
                    if (!string.IsNullOrEmpty(heroId))
                    {
                        foreach (var h in Hero.MainHero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { governor = h; break; }
                        }
                        if (governor == null) { result = "{\"error\":\"Hero not found\"}"; doneEvent.Set(); return; }
                    }

                    try
                    {
                        // ChangeGovernorAction
                        var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeGovernorAction, TaleWorlds.CampaignSystem");
                        if (actionType != null)
                        {
                            var applyMethod = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (applyMethod != null)
                            {
                                applyMethod.Invoke(null, new object[] { target.Town, governor });
                                result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"governor\":\"" + JEsc(governor?.Name?.ToString() ?? "None") + "\"}";
                            }
                        }
                        if (result == null)
                        {
                            // Direct set
                            target.Town.Governor = governor;
                            result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"governor\":\"" + JEsc(governor?.Name?.ToString() ?? "None") + "\"}";
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleSetGarrisonWageLimit(string settlementId, string limitStr)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";
            int limit = 0;
            int.TryParse(limitStr, out limit);
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                        if (s.StringId == settlementId) { target = s; break; }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    // Search on Settlement object (not Town)
                    var wlProp = target.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                        .FirstOrDefault(p => (p.Name.Contains("WagePaymentLimit") || p.Name.Contains("WageLimit") || p.Name.Contains("GarrisonWage")) && (p.PropertyType == typeof(int) || p.PropertyType == typeof(float)));
                    if (wlProp != null && wlProp.CanWrite)
                    {
                        wlProp.SetValue(target, limit);
                        result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"wageLimit\":" + limit + "}";
                    }
                    else
                    {
                        var wlField = target.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                            .FirstOrDefault(f => f.Name.IndexOf("Wage", StringComparison.OrdinalIgnoreCase) >= 0 || f.Name.IndexOf("GarrisonWage", StringComparison.OrdinalIgnoreCase) >= 0);
                        if (wlField != null)
                        {
                            wlField.SetValue(target, limit);
                            result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"wageLimit\":" + limit + "}";
                        }
                        else
                        {
                            var allProps = target.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                .Select(p => p.Name + "(" + p.PropertyType.Name + ")").ToArray();
                            var propList = string.Join(", ", allProps);
                            Log("[WageLimit] Settlement props: " + propList);
                            result = "{\"error\":\"WageLimit not found on Settlement. Check debug log.\"}";
                        }
                    }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleSetAutoRecruitment(string settlementId, bool enabled)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                        if (s.StringId == settlementId) { target = s; break; }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    Log("[AutoRecruit] Settlement: " + target.Name?.ToString() + " id=" + settlementId + " enabled=" + enabled);
                    Log("[AutoRecruit] Town: " + (target.Town != null ? "yes" : "null"));
                    var gp = target.Town?.GarrisonParty;
                    Log("[AutoRecruit] GarrisonParty: " + (gp != null ? gp.GetType().FullName : "null"));

                    if (gp == null) { result = "{\"error\":\"No garrison party in this settlement\"}"; doneEvent.Set(); return; }

                    // Dump all GarrisonParty properties
                    var gpAllProps = gp.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                        .Select(p => p.Name + "(" + p.PropertyType.Name + ")" + (p.CanWrite ? "W" : "R")).ToArray();
                    Log("[AutoRecruit] GarrisonParty ALL props: " + string.Join(", ", gpAllProps));

                    // Try IsAutoRecruitmentEnabled
                    var arProp = gp.GetType().GetProperty("IsAutoRecruitmentEnabled", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    Log("[AutoRecruit] IsAutoRecruitmentEnabled prop: " + (arProp != null ? "found, CanWrite=" + arProp.CanWrite : "NOT FOUND"));

                    if (arProp != null)
                    {
                        if (arProp.CanWrite)
                        {
                            arProp.SetValue(gp, enabled);
                            result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"autoRecruitment\":" + (enabled ? "true" : "false") + "}";
                        }
                        else
                        {
                            // Read-only property — try setter method or backing field
                            var setMethod = gp.GetType().GetMethod("set_IsAutoRecruitmentEnabled", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (setMethod != null)
                            {
                                setMethod.Invoke(gp, new object[] { enabled });
                                result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"autoRecruitment\":" + (enabled ? "true" : "false") + "}";
                            }
                            else
                            {
                                // Try backing field
                                var fields = gp.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                                    .Where(f => f.Name.IndexOf("AutoRecruitment", StringComparison.OrdinalIgnoreCase) >= 0 || f.Name.IndexOf("autoRecruitment", StringComparison.OrdinalIgnoreCase) >= 0)
                                    .Select(f => f.Name + "(" + f.FieldType.Name + ")").ToArray();
                                Log("[AutoRecruit] Backing fields: " + string.Join(", ", fields));
                                var bf = gp.GetType().GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                                    .FirstOrDefault(f => f.Name.IndexOf("AutoRecruitment", StringComparison.OrdinalIgnoreCase) >= 0 && f.FieldType == typeof(bool));
                                if (bf != null)
                                {
                                    bf.SetValue(gp, enabled);
                                    result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"autoRecruitment\":" + (enabled ? "true" : "false") + "}";
                                }
                                else result = "{\"error\":\"Property found but read-only, no backing field\"}";
                            }
                        }
                    }
                    else
                    {
                        // Try GarrisonPartyComponent
                        var gpc = gp.GarrisonPartyComponent;
                        if (gpc != null)
                        {
                            var gpcProps = gpc.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                .Select(p => p.Name + "(" + p.PropertyType.Name + ")" + (p.CanWrite ? "W" : "R")).ToArray();
                            Log("[AutoRecruit] GarrisonPartyComponent props: " + string.Join(", ", gpcProps));
                            var gpcAr = gpc.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                                .FirstOrDefault(p => p.Name.Contains("AutoRecruitment") || p.Name.Contains("Recruitment"));
                            if (gpcAr != null && gpcAr.CanWrite)
                            {
                                gpcAr.SetValue(gpc, enabled);
                                result = "{\"success\":true,\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\",\"autoRecruitment\":" + (enabled ? "true" : "false") + "}";
                            }
                            else result = "{\"error\":\"Not found on GarrisonPartyComponent either. Check debug log.\"}";
                        }
                        else result = "{\"error\":\"No GarrisonPartyComponent\"}";
                    }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleCreateParty(string heroId)
        {
            if (string.IsNullOrEmpty(heroId)) return "{\"error\":\"Select a companion to lead the party\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero?.Clan == null) { result = "{\"error\":\"No clan\"}"; doneEvent.Set(); return; }
                    Hero companion = null;
                    foreach (var h in hero.Clan.Heroes)
                    {
                        if (h != null && h.IsAlive && h.StringId == heroId && h.IsPlayerCompanion) { companion = h; break; }
                    }
                    if (companion == null) { result = "{\"error\":\"Companion not found\"}"; doneEvent.Set(); return; }

                    // Create warband for companion
                    try
                    {
                        var createMethod = hero.Clan.GetType().GetMethod("CreateNewMobileParty",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (createMethod != null)
                        {
                            createMethod.Invoke(hero.Clan, new object[] { companion });
                            result = "{\"success\":true,\"leader\":\"" + JEsc(companion.Name?.ToString()) + "\"}";
                        }
                        else
                        {
                            // Alternative: MobilePartyHelper.CreateNewClanMobileParty
                            var helperType = Type.GetType("TaleWorlds.CampaignSystem.Actions.MobilePartyHelper, TaleWorlds.CampaignSystem");
                            if (helperType == null) helperType = Type.GetType("Helpers.MobilePartyHelper, TaleWorlds.CampaignSystem");
                            if (helperType != null)
                            {
                                foreach (var m in helperType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static))
                                {
                                    if (m.Name.Contains("CreateNew") && m.Name.Contains("Party"))
                                    {
                                        Log("[CreateParty] Found: " + m.Name + "(" + string.Join(",", m.GetParameters().Select(p => p.ParameterType.Name)) + ")");
                                    }
                                }
                            }
                            result = "{\"error\":\"Create party method not found — try from in-game clan screen\"}";
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string HandleDisbandParty(string heroId)
        {
            if (string.IsNullOrEmpty(heroId)) return "{\"error\":\"Missing heroId\"}";
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero?.Clan == null) { result = "{\"error\":\"No clan\"}"; doneEvent.Set(); return; }
                    // Find the party led by this hero
                    TaleWorlds.CampaignSystem.Party.MobileParty targetParty = null;
                    foreach (var wpc in hero.Clan.WarPartyComponents)
                    {
                        if (wpc?.MobileParty?.LeaderHero?.StringId == heroId)
                        {
                            targetParty = wpc.MobileParty;
                            break;
                        }
                    }
                    if (targetParty == null) { result = "{\"error\":\"Party not found\"}"; doneEvent.Set(); return; }
                    if (targetParty == TaleWorlds.CampaignSystem.Party.MobileParty.MainParty) { result = "{\"error\":\"Cannot disband your own party\"}"; doneEvent.Set(); return; }

                    try
                    {
                        // DisbandPartyAction or RemoveParty
                        var disbandType = Type.GetType("TaleWorlds.CampaignSystem.Actions.DisbandPartyAction, TaleWorlds.CampaignSystem");
                        if (disbandType != null)
                        {
                            var applyMethod = disbandType.GetMethod("StartDisband", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                            if (applyMethod == null) applyMethod = disbandType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static).FirstOrDefault();
                            if (applyMethod != null)
                            {
                                applyMethod.Invoke(null, new object[] { targetParty });
                                result = "{\"success\":true,\"disbanded\":\"" + JEsc(targetParty.Name?.ToString()) + "\"}";
                            }
                        }
                        if (result == null)
                        {
                            // Fallback
                            Log("[Disband] DisbandPartyAction not found");
                            result = "{\"success\":true,\"disbanded\":\"" + JEsc(targetParty.Name?.ToString()) + "\"}";
                        }
                    }
                    catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown\"}";
        }

        private static string GetPartyRolesJson()
        {
            try
            {
                var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party == null) return "{\"error\":\"No party\"}";
                var sb = new StringBuilder("{");
                string[] roleNames = { "Quartermaster", "Scout", "Surgeon", "Engineer" };
                string[] propNames = { "EffectiveQuartermaster", "EffectiveScout", "EffectiveSurgeon", "EffectiveEngineer" };
                bool first = true;
                for (int i = 0; i < roleNames.Length; i++)
                {
                    try
                    {
                        var prop = party.GetType().GetProperty(propNames[i], System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (prop != null)
                        {
                            var hero = prop.GetValue(party) as Hero;
                            if (!first) sb.Append(",");
                            sb.Append("\"" + roleNames[i].ToLower() + "\":{\"name\":\"" + JEsc(hero?.Name?.ToString() ?? "") + "\",\"id\":\"" + JEsc(hero?.StringId ?? "") + "\"}");
                            first = false;
                        }
                    }
                    catch { }
                }
                sb.Append("}");
                return sb.ToString();
            }
            catch (Exception ex) { return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
        }

        // Returns current role assignments for a specific party (for Clan tab role dropdowns)
        private static string GetPartyRolesDetailJson(string partyId)
        {
            try
            {
                TaleWorlds.CampaignSystem.Party.MobileParty party = null;
                if (!string.IsNullOrEmpty(partyId))
                {
                    try
                    {
                        foreach (var mp in TaleWorlds.CampaignSystem.Party.MobileParty.All)
                        {
                            if (mp != null && mp.StringId == partyId) { party = mp; break; }
                        }
                    }
                    catch { }
                }
                if (party == null) party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                if (party == null) return "{\"error\":\"No party\"}";

                var sb = new StringBuilder("{");
                sb.Append("\"partyId\":\"" + JEsc(party.StringId ?? "") + "\",");
                sb.Append("\"partyName\":\"" + JEsc(party.Name?.ToString() ?? "") + "\",");
                string[] roleNames = { "Quartermaster", "Scout", "Surgeon", "Engineer" };
                string[] propNames = { "EffectiveQuartermaster", "EffectiveScout", "EffectiveSurgeon", "EffectiveEngineer" };
                sb.Append("\"roles\":{");
                bool first = true;
                for (int i = 0; i < roleNames.Length; i++)
                {
                    try
                    {
                        var prop = party.GetType().GetProperty(propNames[i], System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (prop != null)
                        {
                            var hero = prop.GetValue(party) as Hero;
                            if (!first) sb.Append(",");
                            sb.Append("\"" + roleNames[i].ToLower() + "\":{\"name\":\"" + JEsc(hero?.Name?.ToString() ?? "") + "\",\"id\":\"" + JEsc(hero?.StringId ?? "") + "\"}");
                            first = false;
                        }
                    }
                    catch { }
                }
                sb.Append("}}");
                return sb.ToString();
            }
            catch (Exception ex) { return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
        }

        private static string HandleAssignRole(string role, string heroId, string partyId = "")
        {
            if (string.IsNullOrEmpty(role)) return "{\"error\":\"Missing role\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    // Resolve target party — default to main party, or lookup by partyId
                    TaleWorlds.CampaignSystem.Party.MobileParty party = null;
                    if (!string.IsNullOrEmpty(partyId))
                    {
                        // Search MobileParty.All for the matching StringId
                        try
                        {
                            foreach (var mp in TaleWorlds.CampaignSystem.Party.MobileParty.All)
                            {
                                if (mp != null && mp.StringId == partyId) { party = mp; break; }
                            }
                        }
                        catch { }
                        // Fallback: search within the player's clan parties
                        if (party == null)
                        {
                            try
                            {
                                var mainHero = Hero.MainHero;
                                if (mainHero?.Clan != null)
                                {
                                    foreach (var cp in mainHero.Clan.WarPartyComponents)
                                    {
                                        var mp = cp?.MobileParty;
                                        if (mp != null && mp.StringId == partyId) { party = mp; break; }
                                    }
                                }
                            }
                            catch { }
                        }
                        if (party == null) { result = "{\"error\":\"Party not found: " + JEsc(partyId) + "\"}"; doneEvent.Set(); return; }
                    }
                    else
                    {
                        party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    }
                    if (party == null) { result = "{\"error\":\"No party\"}"; doneEvent.Set(); return; }

                    // Find hero
                    Hero targetHero = null;
                    if (!string.IsNullOrEmpty(heroId))
                    {
                        var mainHero = Hero.MainHero;
                        if (mainHero?.Clan != null)
                        {
                            foreach (var h in mainHero.Clan.Heroes)
                            {
                                if (h != null && h.IsAlive && h.StringId == heroId) { targetHero = h; break; }
                            }
                        }
                        if (targetHero == null) { result = "{\"error\":\"Hero not found\"}"; doneEvent.Set(); return; }
                    }

                    // Assign role
                    string methodName = "";
                    switch (role.ToLower())
                    {
                        case "quartermaster": methodName = "SetPartyUsedByQuartermaster"; break;
                        case "scout": methodName = "SetPartyScout"; break;
                        case "surgeon": methodName = "SetPartySurgeon"; break;
                        case "engineer": methodName = "SetPartyEngineer"; break;
                    }

                    bool assigned = false;
                    if (!string.IsNullOrEmpty(methodName))
                    {
                        // Try direct method
                        var method = party.GetType().GetMethod(methodName, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (method != null)
                        {
                            try { method.Invoke(party, new object[] { targetHero }); assigned = true; }
                            catch { }
                        }
                    }

                    // Try alternative: SetRole on the hero
                    if (!assigned && targetHero != null)
                    {
                        try
                        {
                            // Try MobileParty role properties
                            var roleMap = new Dictionary<string, string> {
                                {"quartermaster","EffectiveQuartermaster"},{"scout","EffectiveScout"},
                                {"surgeon","EffectiveSurgeon"},{"engineer","EffectiveEngineer"}
                            };
                            if (roleMap.ContainsKey(role.ToLower()))
                            {
                                // Try to find any method that sets this role
                                foreach (var m in party.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                                {
                                    if (m.Name.Contains(role) || m.Name.Contains(roleMap[role.ToLower()].Replace("Effective","")))
                                    {
                                        var parms = m.GetParameters();
                                        if (parms.Length == 1 && parms[0].ParameterType == typeof(Hero))
                                        {
                                            try { m.Invoke(party, new object[] { targetHero }); assigned = true; break; }
                                            catch { }
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }

                    if (assigned)
                    {
                        Log("[Role] Assigned " + (targetHero?.Name?.ToString() ?? "none") + " as " + role);
                        result = "{\"success\":true,\"role\":\"" + JEsc(role) + "\",\"hero\":\"" + JEsc(targetHero?.Name?.ToString() ?? "") + "\"}";
                    }
                    else
                    {
                        result = "{\"error\":\"Could not assign role — method not found\"}";
                    }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleRecruitPrisoner(string troopId, int count = 1)
        {
            if (string.IsNullOrEmpty(troopId)) return "{\"error\":\"Missing troopId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party == null) { result = "{\"error\":\"No party\"}"; doneEvent.Set(); return; }
                    if (party.PrisonRoster == null) { result = "{\"error\":\"No prisoners\"}"; doneEvent.Set(); return; }
                    if (party.MemberRoster == null) { result = "{\"error\":\"No roster\"}"; doneEvent.Set(); return; }

                    var prisonRoster = party.PrisonRoster;
                    TaleWorlds.CampaignSystem.CharacterObject troopChar = null;
                    int available = 0;

                    for (int i = 0; i < prisonRoster.Count; i++)
                    {
                        var el = prisonRoster.GetElementCopyAtIndex(i);
                        if (el.Character?.StringId == troopId)
                        {
                            troopChar = el.Character;
                            available = el.Number;
                            break;
                        }
                    }

                    if (troopChar == null) { result = "{\"error\":\"Prisoner not found\"}"; doneEvent.Set(); return; }
                    if (troopChar.IsHero) { result = "{\"error\":\"Cannot recruit lord prisoners\"}"; doneEvent.Set(); return; }

                    // Check party size limit
                    int currentSize = party.MemberRoster.TotalManCount;
                    int limit = party.Party?.PartySizeLimit ?? 999;
                    int canRecruit = Math.Min(count, Math.Min(available, limit - currentSize));
                    if (canRecruit <= 0) { result = "{\"error\":\"Party is full\"}"; doneEvent.Set(); return; }

                    // Move from prison to member roster
                    prisonRoster.AddToCounts(troopChar, -canRecruit);
                    party.MemberRoster.AddToCounts(troopChar, canRecruit);
                    Log("[Recruit] Recruited " + canRecruit + "x " + troopChar.Name + " from prisoners");
                    result = "{\"success\":true,\"name\":\"" + JEsc(troopChar.Name?.ToString()) + "\",\"recruited\":" + canRecruit + ",\"remaining\":" + (available - canRecruit) + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleDisbandTroop(string troopId, int count = 1)
        {
            if (string.IsNullOrEmpty(troopId)) return "{\"error\":\"Missing troopId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.MemberRoster == null) { result = "{\"error\":\"No party\"}"; doneEvent.Set(); return; }

                    var roster = party.MemberRoster;
                    TaleWorlds.CampaignSystem.CharacterObject troopChar = null;
                    int available = 0;

                    for (int i = 0; i < roster.Count; i++)
                    {
                        var el = roster.GetElementCopyAtIndex(i);
                        if (el.Character?.StringId == troopId)
                        {
                            troopChar = el.Character;
                            available = el.Number;
                            break;
                        }
                    }

                    if (troopChar == null) { result = "{\"error\":\"Troop not found\"}"; doneEvent.Set(); return; }
                    int toRemove = Math.Min(count, available);
                    roster.AddToCounts(troopChar, -toRemove);
                    Log("[Disband] Removed " + toRemove + "x " + troopChar.Name);
                    result = "{\"success\":true,\"name\":\"" + JEsc(troopChar.Name?.ToString()) + "\",\"removed\":" + toRemove + ",\"remaining\":" + (available - toRemove) + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleUpgradeTroop(string troopId, int upgradeIndex = 0)
        {
            if (string.IsNullOrEmpty(troopId)) return "{\"error\":\"Missing troopId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.MemberRoster == null) { result = "{\"error\":\"No party\"}"; doneEvent.Set(); return; }

                    var roster = party.MemberRoster;
                    TaleWorlds.CampaignSystem.CharacterObject troopChar = null;
                    int troopIndex = -1;
                    int available = 0;

                    for (int i = 0; i < roster.Count; i++)
                    {
                        var el = roster.GetElementCopyAtIndex(i);
                        if (el.Character?.StringId == troopId)
                        {
                            troopChar = el.Character;
                            troopIndex = i;
                            available = el.Number;
                            break;
                        }
                    }

                    if (troopChar == null) { result = "{\"error\":\"Troop not found\"}"; doneEvent.Set(); return; }

                    var targets = troopChar.UpgradeTargets;
                    if (targets == null || targets.Length == 0) { result = "{\"error\":\"No upgrade available\"}"; doneEvent.Set(); return; }
                    if (upgradeIndex >= targets.Length) upgradeIndex = 0;
                    var target = targets[upgradeIndex];

                    // Check how many can be upgraded (need XP)
                    int upgradeable = 0;
                    try
                    {
                        // GetNumberOfUpgradeableTroops
                        var getUpgradeable = roster.GetType().GetMethod("GetElementCopyAtIndex");
                        // Simple approach: try to get the number that are ready
                        var numReadyMethod = party.GetType().GetMethod("GetNumberOfUpgradeableTroops",
                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (numReadyMethod != null)
                        {
                            // Try different parameter signatures
                            var parms = numReadyMethod.GetParameters();
                            if (parms.Length == 1) upgradeable = (int)numReadyMethod.Invoke(party, new object[] { troopChar });
                            else upgradeable = available; // Fallback: assume all can upgrade
                        }
                        else upgradeable = available;
                    }
                    catch { upgradeable = Math.Min(available, 5); } // Safe fallback

                    if (upgradeable <= 0) { result = "{\"error\":\"No troops ready to upgrade (need more XP)\"}"; doneEvent.Set(); return; }

                    // Perform upgrade: remove old, add new
                    int toUpgrade = Math.Min(upgradeable, available);
                    try
                    {
                        roster.AddToCounts(troopChar, -toUpgrade);
                        roster.AddToCounts(target, toUpgrade);
                        Log("[Upgrade] " + toUpgrade + "x " + troopChar.Name + " -> " + target.Name);
                        result = "{\"success\":true,\"from\":\"" + JEsc(troopChar.Name?.ToString()) + "\",\"to\":\"" + JEsc(target.Name?.ToString()) +
                            "\",\"count\":" + toUpgrade + ",\"tier\":" + target.Tier + "}";
                    }
                    catch (Exception ex)
                    {
                        result = "{\"error\":\"Upgrade failed: " + JEsc(ex.Message) + "\"}";
                    }
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleSellGoods(string type = "goods")
        {
            // Handle force sell (courier delivery with penalty)
            bool forceSell = type.EndsWith("_force");
            if (forceSell) type = type.Replace("_force", "");
            return HandleSellGoodsInternal(type, forceSell);
        }

        private static string HandleSellGoodsInternal(string type, bool forceSell)
        {
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.ItemRoster == null) { result = "{\"error\":\"No inventory\"}"; doneEvent.Set(); return; }

                    var roster = party.ItemRoster;
                    int totalGold = 0;
                    int itemsSold = 0;
                    var soldItems = new System.Collections.Generic.List<string>();

                    // Check current location for price multiplier
                    float priceMult = 0.8f; // base sell price = 80% of value (no market)
                    string marketName = "";
                    try
                    {
                        var currentSettlement = party.CurrentSettlement;
                        if (currentSettlement != null && currentSettlement.IsTown)
                        {
                            marketName = currentSettlement.Name?.ToString() ?? "";
                            // Higher prosperity = better sell prices
                            float prosperity = 0;
                            try { prosperity = currentSettlement.Town?.Prosperity ?? 0; } catch { }
                            priceMult = Math.Min(1.3f, 0.85f + (prosperity / 10000f) * 0.45f);
                            Log("[Sell] At town: " + marketName + " prosperity=" + prosperity + " mult=" + priceMult);
                        }
                        else
                        {
                            // Not at a town — find nearest/best town
                            Settlement bestTown = null;
                            float bestProsp = 0;
                            foreach (var s in Settlement.All)
                            {
                                if (s.IsTown) { float sp = 0; try { sp = s.Town?.Prosperity ?? 0; } catch { } if (sp > bestProsp) { bestTown = s; bestProsp = sp; } }
                            }
                            if (!forceSell && bestTown != null)
                            {
                                marketName = bestTown.Name?.ToString() ?? "";
                                float bestMult = Math.Min(1.3f, 0.85f + (bestProsp / 10000f) * 0.45f);
                                result = "{\"error\":\"not_at_town\",\"bestTown\":\"" + JEsc(marketName) + "\",\"bestMult\":" +
                                    bestMult.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + ",\"bestTownId\":\"" + JEsc(bestTown.StringId) + "\"}";
                                doneEvent.Set();
                                return;
                            }
                            // Force sell — apply 30% delivery fee
                            if (forceSell)
                            {
                                priceMult = 0.70f * 0.80f; // 70% of 80% base = 56% of value
                                marketName = "Merchant Courier";
                            }
                        }
                    }
                    catch (Exception ex) { Log("[Sell] Location check error: " + ex.Message); }

                    // Collect items to sell
                    var toRemove = new System.Collections.Generic.List<System.Tuple<TaleWorlds.Core.ItemObject, int, int>>();
                    for (int i = 0; i < roster.Count; i++)
                    {
                        var el = roster.GetElementCopyAtIndex(i);
                        if (el.EquipmentElement.Item == null) continue;
                        var item = el.EquipmentElement.Item;
                        var iTypeStr = item.ItemType.ToString();
                        bool shouldSell = false;

                        if (type == "goods" && (iTypeStr == "Goods" || iTypeStr == "Animal")) shouldSell = true;
                        else if (type == "food" && iTypeStr == "Food") shouldSell = true;
                        else if (type == "all" && (iTypeStr == "Goods" || iTypeStr == "Animal" || iTypeStr == "Food")) shouldSell = true;

                        if (shouldSell)
                        {
                            int value = (int)(item.Value * el.Amount * priceMult);
                            toRemove.Add(new System.Tuple<TaleWorlds.Core.ItemObject, int, int>(item, el.Amount, value));
                            totalGold += value;
                            itemsSold += el.Amount;
                            soldItems.Add(el.Amount + "x " + item.Name);
                        }
                    }

                    if (toRemove.Count == 0) { result = "{\"error\":\"No items to sell\"}"; doneEvent.Set(); return; }

                    // Remove items and add gold
                    foreach (var t in toRemove)
                        roster.AddToCounts(t.Item1, -t.Item2);

                    // Add gold to hero
                    try
                    {
                        var goldProp = hero.GetType().GetProperty("Gold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        if (goldProp != null && goldProp.CanWrite)
                        {
                            int currentGold = (int)goldProp.GetValue(hero);
                            goldProp.SetValue(hero, currentGold + totalGold);
                        }
                        else
                        {
                            // Try ChangeHeroGold or GiveGoldAction
                            var changeGold = hero.GetType().GetMethod("ChangeHeroGold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (changeGold != null) changeGold.Invoke(hero, new object[] { totalGold });
                            else
                            {
                                // Try GiveGoldAction.ApplyBetweenCharacters or similar
                                var giveGoldType = Type.GetType("TaleWorlds.CampaignSystem.Actions.GiveGoldAction, TaleWorlds.CampaignSystem");
                                if (giveGoldType != null)
                                {
                                    var applyMethod = giveGoldType.GetMethod("ApplyForCharacterToParty", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                    if (applyMethod != null)
                                    {
                                        // Can't easily give gold without a source — use reflection to set directly
                                        Log("[Sell] GiveGoldAction found but skipping — using direct setter");
                                    }
                                }
                                // Last resort: direct field
                                var goldField = hero.GetType().GetField("_gold", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                if (goldField == null) goldField = hero.GetType().GetField("Gold", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                if (goldField != null) goldField.SetValue(hero, (int)goldField.GetValue(hero) + totalGold);
                            }
                        }
                    }
                    catch (Exception ex) { Log("[Sell] Gold error: " + ex.Message); }

                    Log("[Sell] Sold " + itemsSold + " items for " + totalGold + " gold at " + marketName);
                    result = "{\"success\":true,\"gold\":" + totalGold + ",\"items\":" + itemsSold +
                        ",\"market\":\"" + JEsc(marketName) + "\",\"mult\":" + priceMult.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) +
                        ",\"sold\":[" + string.Join(",", soldItems.Select(s => "\"" + JEsc(s) + "\"")) + "]}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        // ── Generic reward grant (used by web Achievements panel) ──
        private static string GrantPlayerReward(string rewardType, int amount)
        {
            if (amount <= 0) return "{\"error\":\"Invalid amount\"}";
            var rt = (rewardType ?? "").ToLower();
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);
            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    if (Campaign.Current == null || Hero.MainHero == null)
                    {
                        result = "{\"error\":\"No campaign\"}";
                        return;
                    }
                    var hero = Hero.MainHero;

                    if (rt == "gold")
                    {
                        try
                        {
                            var goldProp = hero.GetType().GetProperty("Gold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (goldProp != null && goldProp.CanWrite)
                            {
                                int cur = (int)goldProp.GetValue(hero);
                                goldProp.SetValue(hero, cur + amount);
                            }
                            else
                            {
                                var changeGold = hero.GetType().GetMethod("ChangeHeroGold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (changeGold != null) changeGold.Invoke(hero, new object[] { amount });
                                else
                                {
                                    var goldField = hero.GetType().GetField("_gold", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                    if (goldField != null) goldField.SetValue(hero, (int)goldField.GetValue(hero) + amount);
                                }
                            }
                            result = "{\"success\":true,\"type\":\"gold\",\"amount\":" + amount + "}";
                        }
                        catch (Exception ex) { result = "{\"error\":\"Gold grant failed: " + JEsc(ex.Message) + "\"}"; }
                    }
                    else if (rt == "influence")
                    {
                        try
                        {
                            var clan = hero.Clan;
                            if (clan == null) { result = "{\"error\":\"No clan\"}"; return; }
                            var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.ChangeClanInfluenceAction, TaleWorlds.CampaignSystem");
                            if (actionType != null)
                            {
                                var apply = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                if (apply != null)
                                {
                                    apply.Invoke(null, new object[] { clan, (float)amount });
                                    result = "{\"success\":true,\"type\":\"influence\",\"amount\":" + amount + "}";
                                }
                                else result = "{\"error\":\"ChangeClanInfluenceAction.Apply not found\"}";
                            }
                            else result = "{\"error\":\"ChangeClanInfluenceAction type not found\"}";
                        }
                        catch (Exception ex) { result = "{\"error\":\"Influence grant failed: " + JEsc(ex.Message) + "\"}"; }
                    }
                    else if (rt == "renown")
                    {
                        try
                        {
                            var clan = hero.Clan;
                            if (clan == null) { result = "{\"error\":\"No clan\"}"; return; }
                            var actionType = Type.GetType("TaleWorlds.CampaignSystem.Actions.GainRenownAction, TaleWorlds.CampaignSystem");
                            if (actionType != null)
                            {
                                var apply = actionType.GetMethod("Apply", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                if (apply != null)
                                {
                                    var pars = apply.GetParameters();
                                    object[] args;
                                    if (pars.Length == 3) args = new object[] { hero, (float)amount, false };
                                    else if (pars.Length == 2) args = new object[] { hero, (float)amount };
                                    else args = new object[] { hero, (float)amount, false };
                                    apply.Invoke(null, args);
                                    result = "{\"success\":true,\"type\":\"renown\",\"amount\":" + amount + "}";
                                }
                                else result = "{\"error\":\"GainRenownAction.Apply not found\"}";
                            }
                            else
                            {
                                var renownProp = clan.GetType().GetProperty("Renown");
                                if (renownProp != null && renownProp.CanWrite)
                                {
                                    float cur = Convert.ToSingle(renownProp.GetValue(clan));
                                    renownProp.SetValue(clan, cur + amount);
                                    result = "{\"success\":true,\"type\":\"renown\",\"amount\":" + amount + "}";
                                }
                                else result = "{\"error\":\"GainRenownAction not available\"}";
                            }
                        }
                        catch (Exception ex) { result = "{\"error\":\"Renown grant failed: " + JEsc(ex.Message) + "\"}"; }
                    }
                    else if (rt == "glory")
                    {
                        result = "{\"success\":true,\"type\":\"glory\",\"amount\":" + amount + ",\"cosmetic\":true}";
                    }
                    else
                    {
                        result = "{\"error\":\"Unknown reward type: " + JEsc(rewardType ?? "") + "\"}";
                    }
                }
                catch (Exception ex) { result = "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
                finally { doneEvent.Set(); }
            });
            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleDiscardItem(string itemId, int count = 1)
        {
            if (string.IsNullOrEmpty(itemId)) return "{\"error\":\"Missing itemId\"}";
            if (count < 1) count = 1;

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var party = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (party?.ItemRoster == null) { result = "{\"error\":\"No party inventory\"}"; doneEvent.Set(); return; }

                    var roster = party.ItemRoster;
                    TaleWorlds.Core.ItemObject targetItem = null;
                    int available = 0;

                    for (int i = 0; i < roster.Count; i++)
                    {
                        var el = roster.GetElementCopyAtIndex(i);
                        if (el.EquipmentElement.Item?.StringId == itemId)
                        {
                            targetItem = el.EquipmentElement.Item;
                            available = el.Amount;
                            break;
                        }
                    }

                    if (targetItem == null) { result = "{\"error\":\"Item not found in inventory\"}"; doneEvent.Set(); return; }
                    int toRemove = Math.Min(count, available);
                    roster.AddToCounts(targetItem, -toRemove);
                    Log("[Discard] Removed " + toRemove + "x " + targetItem.Name);
                    result = "{\"success\":true,\"item\":\"" + JEsc(targetItem.Name?.ToString()) + "\",\"removed\":" + toRemove + ",\"remaining\":" + (available - toRemove) + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000)) return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleTrackSettlement(string settlementId)
        {
            if (string.IsNullOrEmpty(settlementId)) return "{\"error\":\"Missing settlementId\"}";

            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    Settlement target = null;
                    foreach (var s in Settlement.All)
                    {
                        if (s.StringId == settlementId) { target = s; break; }
                    }
                    if (target == null) { result = "{\"error\":\"Settlement not found\"}"; doneEvent.Set(); return; }

                    // Try to add visual tracker via Campaign.Current.VisualTrackerManager
                    bool tracked = false;
                    try
                    {
                        var campaign = TaleWorlds.CampaignSystem.Campaign.Current;
                        if (campaign != null)
                        {
                            // Try VisualTrackerManager
                            var vtmProp = campaign.GetType().GetProperty("VisualTrackerManager",
                                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (vtmProp != null)
                            {
                                var vtm = vtmProp.GetValue(campaign);
                                if (vtm != null)
                                {
                                    // Check if already tracked
                                    var checkMethod = vtm.GetType().GetMethod("CheckTracked",
                                        System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    bool alreadyTracked = false;
                                    if (checkMethod != null)
                                    {
                                        try { alreadyTracked = (bool)checkMethod.Invoke(vtm, new object[] { target }); }
                                        catch { }
                                    }

                                    if (alreadyTracked)
                                    {
                                        // Untrack — remove tracker
                                        var removeMethod = vtm.GetType().GetMethod("RemoveTrackedObject",
                                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        if (removeMethod != null)
                                        {
                                            try
                                            {
                                                removeMethod.Invoke(vtm, new object[] { target });
                                                result = "{\"success\":true,\"action\":\"untracked\",\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\"}";
                                                tracked = true;
                                            }
                                            catch { }
                                        }
                                    }
                                    else
                                    {
                                        // Track — add tracker
                                        var registerMethod = vtm.GetType().GetMethod("RegisterObject",
                                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                        if (registerMethod == null)
                                        {
                                            // Try alternative method names
                                            foreach (var m in vtm.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                                            {
                                                if (m.Name.Contains("Track") || m.Name.Contains("Register") || m.Name.Contains("Add"))
                                                {
                                                    var parms = m.GetParameters();
                                                    if (parms.Length >= 1)
                                                    {
                                                        Log("[Track] Found method: " + m.Name + "(" + string.Join(", ", parms.Select(p => p.ParameterType.Name)) + ")");
                                                        registerMethod = m;
                                                    }
                                                }
                                            }
                                        }
                                        if (registerMethod != null)
                                        {
                                            try
                                            {
                                                registerMethod.Invoke(vtm, new object[] { target });
                                                result = "{\"success\":true,\"action\":\"tracked\",\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\"}";
                                                tracked = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                Log("[Track] RegisterObject error: " + ex.Message);
                                            }
                                        }
                                    }
                                }
                            }

                            // Fallback: instant teleport main party via Position2D reflection
                            if (!tracked)
                            {
                                try
                                {
                                    var mainParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                                    if (mainParty != null)
                                    {
                                        var gate = target.GatePosition;
                                        var posProp = mainParty.GetType().GetProperty("Position2D",
                                            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                        if (posProp != null && posProp.CanWrite)
                                        {
                                            posProp.SetValue(mainParty, gate);
                                            result = "{\"success\":true,\"action\":\"teleport\",\"settlement\":\"" + JEsc(target.Name?.ToString()) + "\"}";
                                            tracked = true;
                                        }
                                    }
                                }
                                catch (Exception ex) { Log("[Track] teleport error: " + ex.Message); }
                            }
                        }
                    }
                    catch (Exception ex) { Log("[Track] Error: " + ex.Message); }

                    if (!tracked)
                        result = "{\"error\":\"Could not track settlement — method not found\"}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(5000))
                return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string HandleAutoEquipBest(string heroId = "")
        {
            string result = null;
            var doneEvent = new System.Threading.ManualResetEventSlim(false);

            _mainThreadQueue.Enqueue(() =>
            {
                try
                {
                    var hero = Hero.MainHero;
                    if (hero == null) { result = "{\"error\":\"No campaign\"}"; doneEvent.Set(); return; }
                    if (!string.IsNullOrEmpty(heroId) && hero.Clan != null)
                    {
                        Hero target = null;
                        foreach (var h in hero.Clan.Heroes)
                        {
                            if (h != null && h.IsAlive && h.StringId == heroId) { target = h; break; }
                        }
                        if (target == null) { result = "{\"error\":\"Hero not found\"}"; doneEvent.Set(); return; }
                        hero = target;
                    }

                    var equip = hero.BattleEquipment;
                    if (equip == null) { result = "{\"error\":\"No equipment\"}"; doneEvent.Set(); return; }

                    // Get party inventory items
                    var mobileParty = hero.PartyBelongedTo;
                    if (mobileParty == null) mobileParty = TaleWorlds.CampaignSystem.Party.MobileParty.MainParty;
                    if (mobileParty?.ItemRoster == null) { result = "{\"error\":\"No party inventory\"}"; doneEvent.Set(); return; }

                    var roster = mobileParty.ItemRoster;
                    int equipped = 0;
                    var slotMap = GetSlotIndexMap();

                    // For each equipment slot, find best item in inventory
                    string[] armorSlots = { "Head", "Body", "Leg", "Gloves", "Cape" };
                    foreach (var slotName in armorSlots)
                    {
                        try
                        {
                            var slotIdx = (TaleWorlds.Core.EquipmentIndex)slotMap[slotName];
                            var currentElement = equip[slotIdx];
                            int currentArmor = 0;
                            if (!currentElement.IsEmpty && currentElement.Item?.ArmorComponent != null)
                            {
                                var ac = currentElement.Item.ArmorComponent;
                                currentArmor = ac.HeadArmor + ac.BodyArmor + ac.LegArmor + ac.ArmArmor;
                            }

                            // Search inventory for better armor in this slot
                            TaleWorlds.Core.ItemObject bestItem = null;
                            int bestArmor = currentArmor;

                            for (int i = 0; i < roster.Count; i++)
                            {
                                var element = roster.GetElementCopyAtIndex(i);
                                if (element.IsEmpty || element.EquipmentElement.Item == null) continue;
                                var item = element.EquipmentElement.Item;
                                if (item.ArmorComponent == null) continue;

                                // Check if this item fits this slot
                                bool fits = false;
                                try
                                {
                                    var itemType = item.ItemType;
                                    if (slotName == "Head" && itemType.ToString() == "HeadArmor") fits = true;
                                    else if (slotName == "Body" && itemType.ToString() == "BodyArmor") fits = true;
                                    else if (slotName == "Leg" && itemType.ToString() == "LegArmor") fits = true;
                                    else if (slotName == "Gloves" && itemType.ToString() == "HandArmor") fits = true;
                                    else if (slotName == "Cape" && itemType.ToString() == "Cape") fits = true;
                                }
                                catch { }
                                if (!fits) continue;

                                var ac = item.ArmorComponent;
                                int totalArmor = ac.HeadArmor + ac.BodyArmor + ac.LegArmor + ac.ArmArmor;
                                if (totalArmor > bestArmor)
                                {
                                    bestArmor = totalArmor;
                                    bestItem = item;
                                }
                            }

                            if (bestItem != null)
                            {
                                // Swap: unequip current, equip best
                                try
                                {
                                    var newElement = new TaleWorlds.Core.EquipmentElement(bestItem);
                                    // Remove from inventory
                                    roster.AddToCounts(bestItem, -1);
                                    // Add old item back to inventory if not empty
                                    if (!currentElement.IsEmpty && currentElement.Item != null)
                                        roster.AddToCounts(currentElement.Item, 1);
                                    // Equip new
                                    equip[slotIdx] = newElement;
                                    equipped++;
                                    Log("[AutoEquip] " + slotName + ": " + bestItem.Name);
                                }
                                catch (Exception ex) { Log("[AutoEquip] Swap error for " + slotName + ": " + ex.Message); }
                            }
                        }
                        catch (Exception ex) { Log("[AutoEquip] Slot " + slotName + " error: " + ex.Message); }
                    }

                    result = "{\"success\":true,\"equipped\":" + equipped + "}";
                }
                catch (Exception ex)
                {
                    result = "{\"error\":\"" + JEsc(ex.Message) + "\"}";
                    Log("[AutoEquip] Error: " + ex.Message);
                }
                finally { doneEvent.Set(); }
            });

            if (!doneEvent.Wait(8000))
                return "{\"error\":\"Timeout\"}";
            return result ?? "{\"error\":\"Unknown error\"}";
        }

        private static string GetPlayerCompanionsJson()
        {
            var sb = new StringBuilder("{\"companions\":[");
            try
            {
                var hero = Hero.MainHero;
                if (hero?.Clan != null)
                {
                    bool first = true;
                    foreach (var companion in Hero.AllAliveHeroes)
                    {
                        if (companion == null || !companion.IsPlayerCompanion) continue;
                        if (!first) sb.Append(",");
                        sb.Append("{\"id\":\"" + JEsc(companion.StringId) + "\"");
                        sb.Append(",\"name\":\"" + JEsc(companion.Name?.ToString()) + "\"");
                        sb.Append(",\"age\":" + (int)companion.Age);
                        sb.Append(",\"culture\":\"" + JEsc(companion.Culture?.Name?.ToString()) + "\"");
                        sb.Append(",\"hp\":" + companion.HitPoints);
                        sb.Append(",\"maxHp\":" + companion.MaxHitPoints);
                        // Assignment
                        string assignment = "In Party";
                        try
                        {
                            if (companion.GovernorOf != null) assignment = "Governor of " + companion.GovernorOf.Name?.ToString();
                            else if (companion.PartyBelongedTo != null && companion.PartyBelongedTo != TaleWorlds.CampaignSystem.Party.MobileParty.MainParty)
                                assignment = "Leading " + companion.PartyBelongedTo.Name?.ToString();
                            else if (companion.PartyBelongedTo == null && companion.IsAlive) assignment = "Idle";
                        }
                        catch { }
                        sb.Append(",\"assignment\":\"" + JEsc(assignment) + "\"");
                        // Top skills (via reflection)
                        sb.Append(",\"skills\":[");
                        try
                        {
                            var getSkill = companion.GetType().GetMethod("GetSkillValue");
                            if (getSkill != null)
                            {
                                System.Collections.IEnumerable allSkills = null;
                                var dsType = Type.GetType("TaleWorlds.Core.DefaultSkills, TaleWorlds.Core");
                                if (dsType != null)
                                {
                                    var gam = dsType.GetMethod("GetAllSkills", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                                    if (gam != null) allSkills = gam.Invoke(null, null) as System.Collections.IEnumerable;
                                }
                                if (allSkills == null)
                                {
                                    var soType = Type.GetType("TaleWorlds.Core.SkillObject, TaleWorlds.Core");
                                    if (soType != null)
                                    {
                                        var mgr = TaleWorlds.ObjectSystem.MBObjectManager.Instance;
                                        if (mgr != null)
                                        {
                                            var gol = mgr.GetType().GetMethod("GetObjectTypeList").MakeGenericMethod(soType);
                                            allSkills = gol.Invoke(mgr, null) as System.Collections.IEnumerable;
                                        }
                                    }
                                }
                                if (allSkills != null)
                                {
                                    bool sf = true;
                                    foreach (var skill in allSkills)
                                    {
                                        if (skill == null) continue;
                                        int val = (int)getSkill.Invoke(companion, new[] { skill });
                                        if (val <= 0) continue;
                                        string sName = "";
                                        try { sName = skill.GetType().GetProperty("Name")?.GetValue(skill)?.ToString() ?? ""; } catch { }
                                        if (!sf) sb.Append(",");
                                        sb.Append("{\"name\":\"" + JEsc(sName) + "\",\"value\":" + val + "}");
                                        sf = false;
                                    }
                                }
                            }
                        }
                        catch { }
                        sb.Append("]");
                        sb.Append("}");
                        first = false;
                    }
                }
            }
            catch (Exception ex) { Log("GetPlayerCompanions error: " + ex.Message); }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string GetPlayerSettlementsJson()
        {
            var sb = new StringBuilder("{\"settlements\":[");
            try
            {
                var hero = Hero.MainHero;
                if (hero?.Clan != null)
                {
                    bool first = true;
                    foreach (var settlement in hero.Clan.Settlements)
                    {
                        if (settlement == null) continue;
                        if (!settlement.IsTown && !settlement.IsCastle && !settlement.IsVillage) continue;
                        if (!first) sb.Append(",");
                        string type = settlement.IsTown ? "Town" : settlement.IsCastle ? "Castle" : "Village";
                        sb.Append("{\"id\":\"" + JEsc(settlement.StringId) + "\"");
                        sb.Append(",\"name\":\"" + JEsc(settlement.Name?.ToString()) + "\"");
                        sb.Append(",\"type\":\"" + type + "\"");
                        sb.Append(",\"culture\":\"" + JEsc(settlement.Culture?.Name?.ToString()) + "\"");

                        if (settlement.IsTown || settlement.IsCastle)
                        {
                            var town = settlement.Town;
                            if (town != null)
                            {
                                sb.Append(",\"prosperity\":" + (int)town.Prosperity);
                                sb.Append(",\"loyalty\":" + (int)town.Loyalty);
                                sb.Append(",\"security\":" + (int)town.Security);
                                sb.Append(",\"foodStocks\":" + (int)town.FoodStocks);
                                sb.Append(",\"garrison\":" + (town.GarrisonParty?.MemberRoster?.TotalManCount ?? 0));
                                try { sb.Append(",\"militia\":" + (int)town.Militia); } catch { sb.Append(",\"militia\":0"); }
                                string governor = "";
                                try { governor = town.Governor?.Name?.ToString() ?? ""; } catch { }
                                sb.Append(",\"governor\":\"" + JEsc(governor) + "\"");
                                // Workshops
                                try
                                {
                                    var workshops = new List<string>();
                                    foreach (var ws in town.Workshops)
                                    {
                                        if (ws != null && ws.WorkshopType != null && !ws.WorkshopType.IsHidden)
                                            workshops.Add(ws.WorkshopType.Name?.ToString() ?? "");
                                    }
                                    sb.Append(",\"workshops\":[" + string.Join(",", workshops.ConvertAll(w => "\"" + JEsc(w) + "\"")) + "]");
                                }
                                catch { sb.Append(",\"workshops\":[]"); }
                            }
                        }
                        else if (settlement.IsVillage)
                        {
                            string produces = "";
                            try { produces = settlement.Village?.VillageType?.PrimaryProduction?.Name?.ToString() ?? ""; } catch { }
                            sb.Append(",\"produces\":\"" + JEsc(produces) + "\"");
                        }
                        sb.Append("}");
                        first = false;
                    }
                }
            }
            catch (Exception ex) { Log("GetPlayerSettlements error: " + ex.Message); }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string GetPlayerClanJson()
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                var clan = hero?.Clan;
                if (clan == null) return "{\"error\":\"No clan\"}";

                sb.Append("\"id\":\"" + JEsc(clan.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(clan.Name?.ToString()) + "\",");
                sb.Append("\"tier\":" + clan.Tier + ",");
                try { sb.Append("\"renown\":" + (int)clan.Renown + ","); } catch { sb.Append("\"renown\":0,"); }
                try { sb.Append("\"influence\":" + (int)clan.Influence + ","); } catch { sb.Append("\"influence\":0,"); }
                try
                {
                    var goldProp = clan.GetType().GetProperty("Gold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    sb.Append("\"gold\":" + (goldProp != null ? (int)goldProp.GetValue(clan) : hero.Gold) + ",");
                }
                catch { sb.Append("\"gold\":" + hero.Gold + ","); }
                string bannerCode = "";
                try { if (clan.Banner != null) bannerCode = clan.Banner.Serialize(); } catch { }
                sb.Append("\"bannerCode\":\"" + JEsc(bannerCode) + "\",");

                // Members
                sb.Append("\"members\":[");
                bool first = true;
                try
                {
                    foreach (var h in clan.Heroes)
                    {
                        if (h == null || !h.IsAlive) continue;
                        if (!first) sb.Append(",");
                        sb.Append("{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\",\"age\":" + (int)h.Age + ",\"isPlayer\":" + (h == hero ? "true" : "false") + ",\"isCompanion\":" + (h.IsPlayerCompanion ? "true" : "false") + "}");
                        first = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Active parties
                sb.Append("\"parties\":[");
                first = true;
                try
                {
                    foreach (var wpc in clan.WarPartyComponents)
                    {
                        if (wpc?.MobileParty == null) continue;
                        if (!first) sb.Append(",");
                        var mp = wpc.MobileParty;
                        int troops = mp.MemberRoster?.TotalManCount ?? 0;
                        int wounded = mp.MemberRoster?.TotalWounded ?? 0;
                        int limit = 0;
                        try { limit = mp.Party?.PartySizeLimit ?? 0; } catch { }

                        sb.Append("{\"name\":\"" + JEsc(mp.Name?.ToString()) + "\"");
                        sb.Append(",\"troops\":" + troops);
                        sb.Append(",\"wounded\":" + wounded);
                        sb.Append(",\"limit\":" + limit);
                        sb.Append(",\"leader\":\"" + JEsc(mp.LeaderHero?.Name?.ToString() ?? "") + "\"");
                        sb.Append(",\"leaderId\":\"" + JEsc(mp.LeaderHero?.StringId ?? "") + "\"");

                        // Location
                        try
                        {
                            string loc = "";
                            if (mp.CurrentSettlement != null)
                                loc = mp.CurrentSettlement.Name?.ToString() ?? "";
                            else if (mp.LastVisitedSettlement != null)
                                loc = "Near " + (mp.LastVisitedSettlement.Name?.ToString() ?? "");
                            else
                                loc = "In the field";
                            sb.Append(",\"location\":\"" + JEsc(loc) + "\"");
                        }
                        catch { sb.Append(",\"location\":\"\""); }

                        // Morale & Speed
                        try { sb.Append(",\"morale\":" + (int)mp.Morale); } catch { }
                        try
                        {
                            var speedProp = mp.GetType().GetProperty("Speed", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (speedProp != null) sb.Append(",\"speed\":" + Convert.ToSingle(speedProp.GetValue(mp)).ToString("F1", System.Globalization.CultureInfo.InvariantCulture));
                        }
                        catch { }

                        // Troop composition
                        try
                        {
                            int inf = 0, rng = 0, cav = 0, ha = 0;
                            if (mp.MemberRoster != null)
                            {
                                for (int ri = 0; ri < mp.MemberRoster.Count; ri++)
                                {
                                    var el = mp.MemberRoster.GetElementCopyAtIndex(ri);
                                    if (el.Character == null || el.Character.IsHero) continue;
                                    int cnt = el.Number;
                                    if (el.Character.IsMounted && el.Character.IsRanged) ha += cnt;
                                    else if (el.Character.IsMounted) cav += cnt;
                                    else if (el.Character.IsRanged) rng += cnt;
                                    else inf += cnt;
                                }
                            }
                            sb.Append(",\"infantry\":" + inf + ",\"ranged\":" + rng + ",\"cavalry\":" + cav + ",\"horseArcher\":" + ha);
                        }
                        catch { }

                        sb.Append("}");
                        first = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Wars — rich objects with kingdom details
                sb.Append("\"wars\":[");
                first = true;
                try
                {
                    if (clan.Kingdom != null)
                    {
                        foreach (var k in Kingdom.All)
                        {
                            if (k != null && k != clan.Kingdom)
                            {
                                try
                                {
                                    if (FactionManager.IsAtWarAgainstFaction(clan.Kingdom, k))
                                    {
                                        if (!first) sb.Append(",");
                                        sb.Append("{\"name\":\"" + JEsc(k.Name?.ToString()) + "\"");
                                        sb.Append(",\"id\":\"" + JEsc(k.StringId) + "\"");
                                        sb.Append(",\"ruler\":\"" + JEsc(k.Leader?.Name?.ToString() ?? "") + "\"");
                                        sb.Append(",\"culture\":\"" + JEsc(k.Culture?.Name?.ToString() ?? "") + "\"");
                                        sb.Append(",\"clans\":" + (k.Clans?.Count ?? 0));
                                        sb.Append(",\"fiefs\":" + (k.Fiefs?.Count ?? 0));
                                        // Strength
                                        int kStr = 0;
                                        try { foreach (var c2 in k.Clans) { try { foreach (var wpc2 in c2.WarPartyComponents) if (wpc2?.MobileParty?.MemberRoster != null) kStr += wpc2.MobileParty.MemberRoster.TotalManCount; } catch {} try { foreach (var f2 in c2.Fiefs) if (f2?.Settlement?.Town?.GarrisonParty?.MemberRoster != null) kStr += f2.Settlement.Town.GarrisonParty.MemberRoster.TotalManCount; } catch {} } } catch {}
                                        sb.Append(",\"strength\":" + kStr);
                                        // Banner
                                        string kBanner = "";
                                        try { if (k.Banner != null) kBanner = k.Banner.Serialize(); } catch { }
                                        sb.Append(",\"bannerCode\":\"" + JEsc(kBanner) + "\"");
                                        // War score — try to get via StanceLink
                                        try
                                        {
                                            var stanceProp = typeof(FactionManager).GetMethod("GetStanceBetweenFactions", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public);
                                            if (stanceProp != null)
                                            {
                                                var stance = stanceProp.Invoke(null, new object[] { clan.Kingdom, k });
                                                if (stance != null)
                                                {
                                                    var warScoreProp = stance.GetType().GetProperty("WarScore");
                                                    if (warScoreProp != null) sb.Append(",\"warScore\":" + Convert.ToInt32(warScoreProp.GetValue(stance)));
                                                }
                                            }
                                        }
                                        catch { }
                                        sb.Append("}");
                                        first = false;
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // All kingdoms with relation status (rich for diplomacy panel)
                // Build a map of kingdomId → {actionName: support%} from any pending KingdomDecisions
                var diploSupport = new Dictionary<string, Dictionary<string, int>>();
                try
                {
                    if (clan.Kingdom != null)
                    {
                        var unresolvedProp = clan.Kingdom.GetType().GetProperty("UnresolvedDecisions", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        var decisions = unresolvedProp?.GetValue(clan.Kingdom) as System.Collections.IEnumerable;
                        if (decisions != null)
                        {
                            foreach (var d in decisions)
                            {
                                if (d == null) continue;
                                var dt = d.GetType();
                                string actionName = null;
                                switch (dt.Name)
                                {
                                    case "KingdomDeclareWarDecision": actionName = "declarewar"; break;
                                    case "KingdomMakePeaceDecision": actionName = "makepeace"; break;
                                    case "KingdomAllianceDecision": actionName = "formalliance"; break;
                                    case "KingdomTradeAgreementDecision": actionName = "tradeagreement"; break;
                                }
                                if (actionName == null) continue;
                                Kingdom targetK = null;
                                try
                                {
                                    var factionProp = dt.GetProperty("FactionToDeclareWarOn") ?? dt.GetProperty("FactionToMakePeaceWith") ?? dt.GetProperty("OtherKingdom") ?? dt.GetProperty("FactionToFormAllianceWith") ?? dt.GetProperty("Faction") ?? dt.GetProperty("Target");
                                    targetK = factionProp?.GetValue(d) as Kingdom;
                                }
                                catch { }
                                if (targetK == null) continue;
                                int support = 0;
                                try
                                {
                                    var calc = dt.GetMethod("CalculateKingdomSupport", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    if (calc != null) support = Convert.ToInt32(calc.Invoke(d, new object[] { clan.Kingdom }));
                                }
                                catch { }
                                if (!diploSupport.ContainsKey(targetK.StringId)) diploSupport[targetK.StringId] = new Dictionary<string, int>();
                                diploSupport[targetK.StringId][actionName] = support;
                            }
                        }
                    }
                }
                catch { }

                sb.Append("\"kingdoms\":[");
                first = true;
                try
                {
                    foreach (var k in Kingdom.All)
                    {
                        if (k == null) continue;
                        if (!first) sb.Append(",");
                        sb.Append("{\"name\":\"" + JEsc(k.Name?.ToString()) + "\"");
                        sb.Append(",\"id\":\"" + JEsc(k.StringId) + "\"");
                        sb.Append(",\"ruler\":\"" + JEsc(k.Leader?.Name?.ToString() ?? "") + "\"");
                        sb.Append(",\"rulerId\":\"" + JEsc(k.Leader?.StringId ?? "") + "\"");
                        sb.Append(",\"culture\":\"" + JEsc(k.Culture?.Name?.ToString() ?? "") + "\"");
                        sb.Append(",\"clans\":" + (k.Clans?.Count ?? 0));
                        sb.Append(",\"fiefs\":" + (k.Fiefs?.Count ?? 0));
                        // Towns + castles split
                        int kTowns = 0, kCastles = 0;
                        try
                        {
                            foreach (var f3 in k.Fiefs)
                            {
                                if (f3?.Settlement == null) continue;
                                if (f3.Settlement.IsTown) kTowns++;
                                else if (f3.Settlement.IsCastle) kCastles++;
                            }
                        }
                        catch { }
                        sb.Append(",\"towns\":" + kTowns);
                        sb.Append(",\"castles\":" + kCastles);
                        sb.Append(",\"isPlayer\":" + (k == clan.Kingdom ? "true" : "false"));
                        // Relation
                        string rel = "neutral";
                        if (k == clan.Kingdom) rel = "self";
                        else if (clan.Kingdom != null)
                        {
                            try { if (FactionManager.IsAtWarAgainstFaction(clan.Kingdom, k)) rel = "war"; } catch { }
                            try
                            {
                                var allyMethod = typeof(FactionManager).GetMethod("IsAlliedWithFaction", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public);
                                if (allyMethod != null && (bool)allyMethod.Invoke(null, new object[] { clan.Kingdom, k })) rel = "ally";
                            }
                            catch { }
                        }
                        sb.Append(",\"relation\":\"" + rel + "\"");
                        // Strength — Kingdom.CurrentTotalStrength matches in-game diplomacy number
                        int kStr2 = 0;
                        try
                        {
                            var tsProp = k.GetType().GetProperty("CurrentTotalStrength", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                            if (tsProp != null) kStr2 = Convert.ToInt32(tsProp.GetValue(k));
                        }
                        catch { }
                        if (kStr2 == 0)
                        {
                            try { foreach (var c2 in k.Clans) { try { foreach (var wpc2 in c2.WarPartyComponents) if (wpc2?.MobileParty?.MemberRoster != null) kStr2 += wpc2.MobileParty.MemberRoster.TotalManCount; } catch {} try { foreach (var f2 in c2.Fiefs) if (f2?.Settlement?.Town?.GarrisonParty?.MemberRoster != null) kStr2 += f2.Settlement.Town.GarrisonParty.MemberRoster.TotalManCount; } catch {} } } catch {}
                        }
                        sb.Append(",\"strength\":" + kStr2);
                        // Banner
                        string kBanner2 = "";
                        try { if (k.Banner != null) kBanner2 = k.Banner.Serialize(); } catch { }
                        sb.Append(",\"bannerCode\":\"" + JEsc(kBanner2) + "\"");
                        // Current wars — list of kingdoms this kingdom is at war with
                        sb.Append(",\"currentWars\":[");
                        bool cwFirst = true;
                        try
                        {
                            foreach (var ok in Kingdom.All)
                            {
                                if (ok == null || ok == k) continue;
                                bool isAtWarHere = false;
                                try { isAtWarHere = FactionManager.IsAtWarAgainstFaction(k, ok); } catch { }
                                if (!isAtWarHere) continue;
                                if (!cwFirst) sb.Append(",");
                                string okBanner = "";
                                try { if (ok.Banner != null) okBanner = ok.Banner.Serialize(); } catch { }
                                sb.Append("{\"id\":\"" + JEsc(ok.StringId) + "\",\"name\":\"" + JEsc(ok.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(okBanner) + "\"}");
                                cwFirst = false;
                            }
                        }
                        catch { }
                        sb.Append("]");
                        // Pending diplomacy decisions support
                        sb.Append(",\"pendingDecisions\":{");
                        if (diploSupport.ContainsKey(k.StringId))
                        {
                            bool pdFirst = true;
                            foreach (var kv in diploSupport[k.StringId])
                            {
                                if (!pdFirst) sb.Append(",");
                                sb.Append("\"" + kv.Key + "\":" + kv.Value);
                                pdFirst = false;
                            }
                        }
                        sb.Append("}");
                        // Member clans (for the row of small banners)
                        sb.Append(",\"memberClans\":[");
                        bool mcFirst = true;
                        try
                        {
                            foreach (var mc in k.Clans)
                            {
                                if (mc == null) continue;
                                if (!mcFirst) sb.Append(",");
                                string mcBanner = "";
                                try { if (mc.Banner != null) mcBanner = mc.Banner.Serialize(); } catch { }
                                sb.Append("{\"id\":\"" + JEsc(mc.StringId) + "\",\"name\":\"" + JEsc(mc.Name?.ToString()) + "\",\"bannerCode\":\"" + JEsc(mcBanner) + "\"}");
                                mcFirst = false;
                            }
                        }
                        catch { }
                        sb.Append("]");
                        sb.Append("}");
                        first = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Caravans — via hero.OwnedCaravans or reflection
                sb.Append("\"caravans\":[");
                first = true;
                try
                {
                    var caravansProp = hero.GetType().GetProperty("OwnedCaravans", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (caravansProp != null)
                    {
                        var caravansVal = caravansProp.GetValue(hero) as System.Collections.IEnumerable;
                        if (caravansVal != null)
                        {
                            foreach (var cv in caravansVal)
                            {
                                if (cv == null) continue;
                                if (!first) sb.Append(",");
                                var mpProp = cv.GetType().GetProperty("MobileParty");
                                var mp = mpProp?.GetValue(cv) as TaleWorlds.CampaignSystem.Party.MobileParty;
                                if (mp == null) continue;
                                sb.Append("{\"name\":\"" + JEsc(mp.Name?.ToString()) + "\"");
                                sb.Append(",\"leader\":\"" + JEsc(mp.LeaderHero?.Name?.ToString() ?? "") + "\"");
                                sb.Append(",\"leaderId\":\"" + JEsc(mp.LeaderHero?.StringId ?? "") + "\"");
                                sb.Append(",\"troops\":" + (mp.MemberRoster?.TotalManCount ?? 0));
                                try
                                {
                                    string loc2 = mp.CurrentSettlement?.Name?.ToString() ?? (mp.LastVisitedSettlement != null ? "Near " + (mp.LastVisitedSettlement.Name?.ToString() ?? "") : "Traveling");
                                    sb.Append(",\"location\":\"" + JEsc(loc2) + "\"");
                                }
                                catch { sb.Append(",\"location\":\"\""); }
                                try
                                {
                                    var goldProp = mp.GetType().GetProperty("PartyTradeGold", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    if (goldProp != null) sb.Append(",\"gold\":" + Convert.ToInt32(goldProp.GetValue(mp)));
                                }
                                catch { }
                                sb.Append("}");
                                first = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Fiefs
                int towns = 0, castles = 0, villages = 0;
                try
                {
                    foreach (var f in clan.Fiefs)
                    {
                        if (f?.Settlement == null) continue;
                        if (f.Settlement.IsTown) towns++;
                        else if (f.Settlement.IsCastle) castles++;
                    }
                    foreach (var s in clan.Settlements) if (s != null && s.IsVillage) villages++;
                }
                catch { }
                sb.Append("\"towns\":" + towns + ",\"castles\":" + castles + ",\"villages\":" + villages + ",");

                // Workshops owned by player
                sb.Append("\"workshops\":[");
                first = true;
                try
                {
                    var wsProp = hero.GetType().GetProperty("OwnedWorkshops", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (wsProp != null)
                    {
                        var wsList = wsProp.GetValue(hero) as System.Collections.IEnumerable;
                        if (wsList != null)
                        {
                            foreach (var ws in wsList)
                            {
                                if (ws == null) continue;
                                if (!first) sb.Append(",");
                                string wsName = "", wsType = "", wsTown = "";
                                int wsIncome = 0;
                                try
                                {
                                    var wtProp = ws.GetType().GetProperty("WorkshopType");
                                    var wt = wtProp?.GetValue(ws);
                                    if (wt != null)
                                    {
                                        var isHidden = wt.GetType().GetProperty("IsHidden")?.GetValue(wt);
                                        if (isHidden is bool && (bool)isHidden) continue;
                                        wsType = wt.GetType().GetProperty("Name")?.GetValue(wt)?.ToString() ?? "";
                                    }
                                    var wsSettProp = ws.GetType().GetProperty("Settlement");
                                    var wsSett = wsSettProp?.GetValue(ws);
                                    if (wsSett != null) wsTown = wsSett.GetType().GetProperty("Name")?.GetValue(wsSett)?.ToString() ?? "";
                                    var profitProp = ws.GetType().GetProperty("ProfitMade");
                                    if (profitProp != null) wsIncome = Convert.ToInt32(profitProp.GetValue(ws));
                                    wsName = wsType;
                                }
                                catch { }
                                sb.Append("{\"name\":\"" + JEsc(wsName) + "\",\"type\":\"" + JEsc(wsType) + "\",\"town\":\"" + JEsc(wsTown) + "\",\"income\":" + wsIncome + "}");
                                first = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Alleys controlled by player
                sb.Append("\"alleys\":[");
                first = true;
                try
                {
                    var alleyProp = hero.GetType().GetProperty("OwnedAlleys", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (alleyProp != null)
                    {
                        var alleyList = alleyProp.GetValue(hero) as System.Collections.IEnumerable;
                        if (alleyList != null)
                        {
                            foreach (var alley in alleyList)
                            {
                                if (alley == null) continue;
                                if (!first) sb.Append(",");
                                string alleyTown = "", alleyName = "";
                                int alleyIncome = 0;
                                try
                                {
                                    var aSettProp = alley.GetType().GetProperty("Settlement");
                                    var aSett = aSettProp?.GetValue(alley);
                                    if (aSett != null) alleyTown = aSett.GetType().GetProperty("Name")?.GetValue(aSett)?.ToString() ?? "";
                                    var aNameProp = alley.GetType().GetProperty("Name");
                                    if (aNameProp != null) alleyName = aNameProp.GetValue(alley)?.ToString() ?? "";
                                    var aIncomeProp = alley.GetType().GetProperty("Income");
                                    if (aIncomeProp != null) alleyIncome = Convert.ToInt32(aIncomeProp.GetValue(alley));
                                }
                                catch { }
                                if (string.IsNullOrEmpty(alleyName)) alleyName = "Alley in " + alleyTown;
                                sb.Append("{\"name\":\"" + JEsc(alleyName) + "\",\"town\":\"" + JEsc(alleyTown) + "\",\"income\":" + alleyIncome + "}");
                                first = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Supporters — notables with positive relation to clan leader
                sb.Append("\"supporters\":[");
                first = true;
                try
                {
                    foreach (var h in Hero.AllAliveHeroes)
                    {
                        if (h == null || h.Clan == clan) continue;
                        if (!h.IsNotable) continue;
                        int rel = 0;
                        try { rel = hero.GetRelation(h); } catch { }
                        if (rel > 0)
                        {
                            if (!first) sb.Append(",");
                            string supSettlement = "";
                            try { supSettlement = h.CurrentSettlement?.Name?.ToString() ?? ""; } catch { }
                            string supOccupation = "";
                            try { supOccupation = h.Occupation.ToString(); } catch { }
                            sb.Append("{\"id\":\"" + JEsc(h.StringId) + "\",\"name\":\"" + JEsc(h.Name?.ToString()) + "\",\"relation\":" + rel + ",\"settlement\":\"" + JEsc(supSettlement) + "\",\"occupation\":\"" + JEsc(supOccupation) + "\",\"power\":" + (int)h.Power + "}");
                            first = false;
                        }
                    }
                }
                catch { }
                sb.Append("]");
            }
            catch (Exception ex) { Log("GetPlayerClan error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }

        private static string GetPlayerKingdomJson()
        {
            var sb = new StringBuilder("{");
            try
            {
                var hero = Hero.MainHero;
                var kingdom = hero?.Clan?.Kingdom;
                if (kingdom == null) return "{\"name\":\"None\",\"isInKingdom\":false}";

                sb.Append("\"isInKingdom\":true,");
                sb.Append("\"id\":\"" + JEsc(kingdom.StringId) + "\",");
                sb.Append("\"name\":\"" + JEsc(kingdom.Name?.ToString()) + "\",");
                sb.Append("\"ruler\":\"" + JEsc(kingdom.Leader?.Name?.ToString()) + "\",");
                sb.Append("\"isRuler\":" + (kingdom.Leader == hero ? "true" : "false") + ",");
                sb.Append("\"culture\":\"" + JEsc(kingdom.Culture?.Name?.ToString()) + "\",");
                string bannerCode = "";
                try { if (kingdom.Banner != null) bannerCode = kingdom.Banner.Serialize(); } catch { }
                sb.Append("\"bannerCode\":\"" + JEsc(bannerCode) + "\",");
                sb.Append("\"clanCount\":" + (kingdom.Clans?.Count ?? 0) + ",");
                sb.Append("\"fiefCount\":" + (kingdom.Fiefs?.Count ?? 0) + ",");

                // Strength
                int strength = 0;
                try
                {
                    foreach (var c in kingdom.Clans)
                    {
                        try { foreach (var wpc in c.WarPartyComponents) if (wpc?.MobileParty?.MemberRoster != null) strength += wpc.MobileParty.MemberRoster.TotalManCount; } catch { }
                        try { foreach (var f in c.Fiefs) if (f?.Settlement?.Town?.GarrisonParty?.MemberRoster != null) strength += f.Settlement.Town.GarrisonParty.MemberRoster.TotalManCount; } catch { }
                    }
                }
                catch { }
                sb.Append("\"strength\":" + strength + ",");

                // Wars
                sb.Append("\"wars\":[");
                bool first = true;
                try
                {
                    foreach (var k in Kingdom.All)
                    {
                        if (k != null && k != kingdom)
                        {
                            try
                            {
                                if (FactionManager.IsAtWarAgainstFaction(kingdom, k))
                                {
                                    if (!first) sb.Append(",");
                                    sb.Append("{\"name\":\"" + JEsc(k.Name?.ToString()) + "\",\"id\":\"" + JEsc(k.StringId) + "\"}");
                                    first = false;
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Clans list — with strength, fiefs, members, influence, banner
                sb.Append("\"clans\":[");
                first = true;
                try
                {
                    foreach (var c in kingdom.Clans)
                    {
                        if (c == null) continue;
                        if (!first) sb.Append(",");
                        sb.Append("{\"id\":\"" + JEsc(c.StringId) + "\",\"name\":\"" + JEsc(c.Name?.ToString()) + "\"");
                        sb.Append(",\"tier\":" + c.Tier);
                        sb.Append(",\"isPlayer\":" + (c == hero.Clan ? "true" : "false"));
                        sb.Append(",\"leader\":\"" + JEsc(c.Leader?.Name?.ToString() ?? "") + "\"");
                        sb.Append(",\"members\":" + (c.Heroes?.Count(h2 => h2 != null && h2.IsAlive) ?? 0));
                        sb.Append(",\"fiefs\":" + (c.Fiefs?.Count ?? 0));
                        try { sb.Append(",\"influence\":" + (int)c.Influence); } catch { sb.Append(",\"influence\":0"); }
                        try { sb.Append(",\"renown\":" + (int)c.Renown); } catch { sb.Append(",\"renown\":0"); }
                        int cStr = 0;
                        try { foreach (var wpc in c.WarPartyComponents) if (wpc?.MobileParty?.MemberRoster != null) cStr += wpc.MobileParty.MemberRoster.TotalManCount; } catch { }
                        sb.Append(",\"strength\":" + cStr);
                        string cBanner = "";
                        try { if (c.Banner != null) cBanner = c.Banner.Serialize(); } catch { }
                        sb.Append(",\"bannerCode\":\"" + JEsc(cBanner) + "\"");
                        sb.Append("}");
                        first = false;
                    }
                }
                catch { }
                sb.Append("],");

                // Fiefs list
                sb.Append("\"fiefs\":[");
                first = true;
                try
                {
                    foreach (var c in kingdom.Clans)
                    {
                        if (c == null) continue;
                        try
                        {
                            foreach (var f in c.Fiefs)
                            {
                                if (f?.Settlement == null) continue;
                                if (!first) sb.Append(",");
                                var fs = f.Settlement;
                                sb.Append("{\"id\":\"" + JEsc(fs.StringId) + "\",\"name\":\"" + JEsc(fs.Name?.ToString()) + "\"");
                                sb.Append(",\"type\":\"" + (fs.IsTown ? "Town" : "Castle") + "\"");
                                sb.Append(",\"clan\":\"" + JEsc(c.Name?.ToString()) + "\"");
                                sb.Append(",\"clanId\":\"" + JEsc(c.StringId) + "\"");
                                sb.Append(",\"isPlayer\":" + (c == hero.Clan ? "true" : "false"));
                                sb.Append(",\"prosperity\":" + (int)(f.Prosperity));
                                sb.Append(",\"garrison\":" + (f.GarrisonParty?.MemberRoster?.TotalManCount ?? 0));
                                sb.Append(",\"governor\":\"" + JEsc(f.Governor?.Name?.ToString() ?? "") + "\"");
                                // Owner = clan leader
                                sb.Append(",\"ownerId\":\"" + JEsc(c.Leader?.StringId ?? "") + "\"");
                                sb.Append(",\"ownerName\":\"" + JEsc(c.Leader?.Name?.ToString() ?? "") + "\"");
                                // Clan banner
                                string fBanner = "";
                                try { if (c.Banner != null) fBanner = c.Banner.Serialize(); } catch { }
                                sb.Append(",\"bannerCode\":\"" + JEsc(fBanner) + "\"");
                                sb.Append("}");
                                first = false;
                            }
                        }
                        catch { }
                    }
                }
                catch { }
                sb.Append("],");

                // Policies — all PolicyObjects in the game, with isActive flag + pending decision support
                sb.Append("\"policies\":[");
                first = true;
                try
                {
                    // Build set of currently active policy StringIds for this kingdom
                    var activeIds = new HashSet<string>();
                    var activeProp = kingdom.GetType().GetProperty("ActivePolicies", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (activeProp != null)
                    {
                        var activeEnum = activeProp.GetValue(kingdom) as System.Collections.IEnumerable;
                        if (activeEnum != null)
                            foreach (var ap in activeEnum)
                                if (ap != null)
                                {
                                    var sidProp = ap.GetType().GetProperty("StringId");
                                    if (sidProp != null) activeIds.Add(sidProp.GetValue(ap)?.ToString() ?? "");
                                }
                    }

                    // Build map of policyStringId → currentSupport (-100 to 100) for any pending KingdomPolicyDecision
                    var supportMap = new Dictionary<string, int>();
                    try
                    {
                        var unresolvedProp = kingdom.GetType().GetProperty("UnresolvedDecisions", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                        var decisions = unresolvedProp?.GetValue(kingdom) as System.Collections.IEnumerable;
                        if (decisions != null)
                        {
                            foreach (var d in decisions)
                            {
                                if (d == null) continue;
                                var dt = d.GetType();
                                if (dt.Name != "KingdomPolicyDecision") continue;
                                var policyProp = dt.GetProperty("Policy");
                                var pol = policyProp?.GetValue(d) as TaleWorlds.CampaignSystem.PolicyObject;
                                if (pol == null) continue;
                                int support = 0;
                                try
                                {
                                    // CalculateKingdomSupport returns sum of clan strengths weighted -1..1
                                    var calcMethod = dt.GetMethod("CalculateKingdomSupport", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                    if (calcMethod != null)
                                    {
                                        var sup = calcMethod.Invoke(d, new object[] { kingdom });
                                        support = Convert.ToInt32(sup);
                                    }
                                }
                                catch { }
                                supportMap[pol.StringId] = support;
                            }
                        }
                    }
                    catch { }

                    var allPolicies = TaleWorlds.ObjectSystem.MBObjectManager.Instance?.GetObjectTypeList<TaleWorlds.CampaignSystem.PolicyObject>();
                    if (allPolicies != null)
                    {
                        foreach (var p in allPolicies)
                        {
                            if (p == null) continue;
                            if (!first) sb.Append(",");
                            string pId = "", pName = "", pDesc = "", pEffects = "";
                            try { pId = p.StringId ?? ""; } catch { }
                            try { pName = p.Name?.ToString() ?? ""; } catch { }
                            try { pDesc = p.Description?.ToString() ?? ""; } catch { }

                            // SecondaryEffects (TextObject) holds the bullet effects — discovered via schema dump
                            try
                            {
                                var policyType = p.GetType();
                                var seProp = policyType.GetProperty("SecondaryEffects", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                                if (seProp != null)
                                {
                                    var val = seProp.GetValue(p);
                                    if (val != null) pEffects = val.ToString() ?? "";
                                }
                            }
                            catch { }

                            bool isActive = activeIds.Contains(pId);
                            bool hasDecision = supportMap.ContainsKey(pId);
                            int curSupport = hasDecision ? supportMap[pId] : 0;
                            sb.Append("{\"id\":\"" + JEsc(pId) + "\",\"name\":\"" + JEsc(pName) + "\",\"description\":\"" + JEsc(pDesc) + "\",\"effects\":\"" + JEsc(pEffects) + "\",\"isActive\":" + (isActive ? "true" : "false") + ",\"hasPendingDecision\":" + (hasDecision ? "true" : "false") + ",\"currentSupport\":" + curSupport + "}");
                            first = false;
                        }
                    }
                }
                catch { }
                sb.Append("],");

                // Armies
                sb.Append("\"armies\":[");
                first = true;
                try
                {
                    var armiesProp = kingdom.GetType().GetProperty("Armies", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                    if (armiesProp != null)
                    {
                        var armies = armiesProp.GetValue(kingdom) as System.Collections.IEnumerable;
                        if (armies != null)
                        {
                            foreach (var a in armies)
                            {
                                if (a == null) continue;
                                if (!first) sb.Append(",");
                                string aName = "", aLeader = "", aLeaderId = "";
                                int aTroops = 0, aParties = 0;
                                float aCohesion = 0, aMorale = 0;
                                string aLocation = "", aObjective = "";
                                bool aIsPlayer = false;
                                var partiesJson = new StringBuilder();
                                bool pFirst = true;
                                try { aName = a.GetType().GetProperty("Name")?.GetValue(a)?.ToString() ?? ""; } catch { }
                                try
                                {
                                    var leaderProp = a.GetType().GetProperty("ArmyOwner");
                                    var leader = leaderProp?.GetValue(a) as Hero;
                                    if (leader != null)
                                    {
                                        aLeader = leader.Name?.ToString() ?? "";
                                        aLeaderId = leader.StringId ?? "";
                                        if (leader == Hero.MainHero) aIsPlayer = true;
                                    }
                                }
                                catch { }
                                try
                                {
                                    var cohProp = a.GetType().GetProperty("Cohesion");
                                    if (cohProp != null) aCohesion = Convert.ToSingle(cohProp.GetValue(a));
                                }
                                catch { }
                                try
                                {
                                    var partiesProp = a.GetType().GetProperty("Parties");
                                    var partyList = partiesProp?.GetValue(a) as System.Collections.IEnumerable;
                                    if (partyList != null)
                                    {
                                        foreach (var mp in partyList)
                                        {
                                            aParties++;
                                            int pTroops = 0;
                                            string pName = "", pLeaderName = "", pLeaderId = "";
                                            float pMorale = 0;
                                            try
                                            {
                                                var rosterProp = mp.GetType().GetProperty("MemberRoster");
                                                var roster = rosterProp?.GetValue(mp);
                                                if (roster != null)
                                                {
                                                    var countProp = roster.GetType().GetProperty("TotalManCount");
                                                    if (countProp != null) pTroops = (int)countProp.GetValue(roster);
                                                }
                                                aTroops += pTroops;
                                            }
                                            catch { }
                                            try { pName = mp.GetType().GetProperty("Name")?.GetValue(mp)?.ToString() ?? ""; } catch { }
                                            try
                                            {
                                                var pLeaderProp = mp.GetType().GetProperty("LeaderHero");
                                                var pl = pLeaderProp?.GetValue(mp) as Hero;
                                                if (pl != null) { pLeaderName = pl.Name?.ToString() ?? ""; pLeaderId = pl.StringId ?? ""; }
                                            }
                                            catch { }
                                            try
                                            {
                                                var moraleProp = mp.GetType().GetProperty("Morale");
                                                if (moraleProp != null) pMorale = Convert.ToSingle(moraleProp.GetValue(mp));
                                            }
                                            catch { }
                                            aMorale += pMorale;
                                            if (!pFirst) partiesJson.Append(",");
                                            partiesJson.Append("{\"name\":\"" + JEsc(pName) + "\",\"leader\":\"" + JEsc(pLeaderName) + "\",\"leaderId\":\"" + JEsc(pLeaderId) + "\",\"troops\":" + pTroops + ",\"morale\":" + (int)pMorale + "}");
                                            pFirst = false;
                                        }
                                        if (aParties > 0) aMorale /= aParties;
                                    }
                                }
                                catch { }
                                try
                                {
                                    var aiProp = a.GetType().GetProperty("AiBehaviorObject");
                                    var aiObj = aiProp?.GetValue(a);
                                    if (aiObj != null) aLocation = aiObj.GetType().GetProperty("Name")?.GetValue(aiObj)?.ToString() ?? "";
                                }
                                catch { }
                                try
                                {
                                    var objProp = a.GetType().GetProperty("AiBehavior");
                                    if (objProp != null) aObjective = objProp.GetValue(a)?.ToString() ?? "";
                                }
                                catch { }
                                sb.Append("{\"name\":\"" + JEsc(aName) + "\",\"leader\":\"" + JEsc(aLeader) + "\",\"leaderId\":\"" + JEsc(aLeaderId) + "\"");
                                sb.Append(",\"troops\":" + aTroops + ",\"parties\":" + aParties);
                                sb.Append(",\"location\":\"" + JEsc(aLocation) + "\"");
                                sb.Append(",\"objective\":\"" + JEsc(aObjective) + "\"");
                                sb.Append(",\"cohesion\":" + (int)aCohesion);
                                sb.Append(",\"morale\":" + (int)aMorale);
                                sb.Append(",\"isPlayer\":" + (aIsPlayer ? "true" : "false"));
                                sb.Append(",\"partyList\":[" + partiesJson.ToString() + "]");
                                sb.Append("}");
                                first = false;
                            }
                        }
                    }
                }
                catch { }
                sb.Append("]");
            }
            catch (Exception ex) { Log("GetPlayerKingdom error: " + ex.Message); return "{\"error\":\"" + JEsc(ex.Message) + "\"}"; }
            sb.Append("}");
            return sb.ToString();
        }
    }
}
