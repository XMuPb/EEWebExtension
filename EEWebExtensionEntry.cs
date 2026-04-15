using System;
using System.IO;
using TaleWorlds.Core;
using TaleWorlds.Library;
using TaleWorlds.MountAndBlade;
using TaleWorlds.CampaignSystem;

namespace EEWebExtension
{
    /// <summary>
    /// Entry point for the EEWebExtension mod.
    /// Starts the local web server that serves the encyclopedia SPA and REST API.
    /// Requires EditableEncyclopedia to be loaded first.
    /// </summary>
    public class EEWebExtensionEntry : MBSubModuleBase
    {
        private string _webRoot;
        private WebExportBehavior _exportBehavior;

        protected override void OnSubModuleLoad()
        {
            base.OnSubModuleLoad();

            // Resolve Web/ folder path relative to this DLL
            try
            {
                string dllPath = typeof(EEWebExtensionEntry).Assembly.Location;
                // DLL is at: Modules/EEWebExtension/bin/Win64_Shipping_Client/EEWebExtension.dll
                // Web root:  Modules/EEWebExtension/Web/
                string moduleFolder = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(dllPath), "..", ".."));
                _webRoot = Path.Combine(moduleFolder, "Web");

                if (!Directory.Exists(_webRoot))
                {
                    // Fallback: try BasePath
                    string basePath = TaleWorlds.Library.BasePath.Name;
                    _webRoot = Path.Combine(basePath, "Modules", "EEWebExtension", "Web");
                }
            }
            catch (Exception ex)
            {
                try { EditableEncyclopedia.MCMSettings.DebugLog("[EEWebExtension] Failed to resolve web root: " + ex.Message); } catch { }
            }
        }

        protected override void OnGameStart(Game game, IGameStarter gameStarterObject)
        {
            base.OnGameStart(game, gameStarterObject);

            // Check if the user has disabled the web extension in MCM settings
            try
            {
                var settings = EditableEncyclopedia.MCMSettings.Instance;
                if (settings != null && !settings.EnableWebExtension)
                {
                    EditableEncyclopedia.MCMSettings.DebugLog("[EEWebExtension] Web extension disabled in MCM settings — skipping server start");
                    DisplayStatus(
                        "[Editable Encyclopedia] Web Extension loaded but DISABLED in MCM settings.",
                        Colors.Yellow);
                    return;
                }
            }
            catch { }

            try
            {
                EncyclopediaWebServer.Start(_webRoot);

                DisplayStatus(
                    "[Editable Encyclopedia] Web Extension v1.0.0 — Server running at http://127.0.0.1:8080/",
                    Colors.Green);
                DisplayStatus(
                    "[Editable Encyclopedia] Open your browser to view the living archive. By XMuPb.",
                    Colors.Green);
            }
            catch (Exception ex)
            {
                try { EditableEncyclopedia.MCMSettings.DebugLog("[EEWebExtension] WebServer start failed: " + ex.Message); } catch { }

                DisplayStatus(
                    "[Editable Encyclopedia] Web Extension FAILED to start: " + ex.Message,
                    Colors.Red);
            }

            // Register campaign behavior for post-session export
            if (gameStarterObject is CampaignGameStarter campaignStarter)
            {
                _exportBehavior = new WebExportBehavior();
                campaignStarter.AddBehavior(_exportBehavior);
            }
        }

        protected override void OnSubModuleUnloaded()
        {
            base.OnSubModuleUnloaded();
            try { EncyclopediaWebServer.Stop(); } catch { }
        }

        protected override void OnApplicationTick(float dt)
        {
            base.OnApplicationTick(dt);
            try { EncyclopediaWebServer.ProcessMainThreadQueue(); } catch { }
            try { _exportBehavior?.OnTick(); } catch { }
        }

        /// <summary>
        /// Displays a colored status message in the game's bottom-left message log.
        /// </summary>
        private static void DisplayStatus(string text, Color color)
        {
            try
            {
                InformationManager.DisplayMessage(new InformationMessage(text, color));
            }
            catch { }
        }
    }

    /// <summary>
    /// Campaign behavior that triggers banner/portrait export after the session is fully loaded
    /// (post character creation, post save load).
    /// </summary>
    internal class WebExportBehavior : CampaignBehaviorBase
    {
        private bool _exportStarted = false;
        private int _tickCount = 0;

        public override void RegisterEvents() { }
        public override void SyncData(IDataStore dataStore) { }

        /// <summary>
        /// Called each application tick — waits until the player is fully on the campaign map
        /// with an active party before starting banner export. Checks every ~2 seconds.
        /// </summary>
        public void OnTick()
        {
            if (_exportStarted) return;

            // Only check every ~300 ticks (~5 seconds at 60fps) to avoid overhead
            _tickCount++;
            if (_tickCount < 300) return;
            _tickCount = 0;

            try
            {
                // Wait until the player has ACTUALLY started playing:
                // - Campaign must exist and have started
                // - MainHero must have a party
                // - Campaign time must have advanced past day 0 (character creation is day 0)
                //   OR the hero must have moved (position != starting position)
                // This prevents export during character creation dialogs which overlay the MapScreen
                bool ready = false;
                try
                {
                    if (Campaign.Current == null) return;
                    var hero = Hero.MainHero;
                    if (hero == null || hero.PartyBelongedTo == null) return;

                    // Check if campaign time has advanced beyond the very start
                    // Character creation happens at the very beginning — once the player
                    // dismisses all dialogs and starts playing, time advances
                    float days = 0;
                    try
                    {
                        // Use reflection since CampaignStartTime may not exist in all versions
                        var cstProp = typeof(Campaign).GetProperty("CampaignStartTime",
                            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                        if (cstProp != null)
                        {
                            var startTime = cstProp.GetValue(Campaign.Current);
                            if (startTime != null)
                            {
                                var elapsedProp = startTime.GetType().GetProperty("ElapsedDaysUntilNow",
                                    System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                                if (elapsedProp != null)
                                    days = (float)elapsedProp.GetValue(startTime);
                            }
                        }
                    }
                    catch { }
                    if (days > 0.5f)
                    {
                        ready = true;
                    }
                    else
                    {
                        // Fallback: check if the game is NOT paused (player is actually playing)
                        // During character creation dialogs, the game is paused
                        try
                        {
                            bool isPaused = Campaign.Current.TimeControlMode == CampaignTimeControlMode.Stop
                                         || Campaign.Current.TimeControlMode == CampaignTimeControlMode.StoppablePlay;
                            // If unpaused and on map, we're good
                            if (!isPaused) ready = true;
                        }
                        catch { }
                    }
                }
                catch { return; }

                if (!ready) return;

                _exportStarted = true;
                EncyclopediaWebServer.ClearPortraits();
                EncyclopediaWebServer.StartExport();
                EditableEncyclopedia.MCMSettings.DebugLog("[EEWebExtension] Campaign map active — starting banner export");
            }
            catch { }
        }
    }
}
