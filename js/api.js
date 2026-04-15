/**
 * API client for the Bannerlord Editable Encyclopedia web extension.
 * Wraps all REST endpoints served by the local game mod server.
 */

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[API]', url, e.message);
    return null;
  }
}

function jsonBody(data) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

const API = {

  // ── Status ──────────────────────────────────────────────────────────

  async getStatus() {
    return await apiFetch('/api/status');
  },

  // Grant a reward to the player (achievements claim flow)
  async grantReward(type, amount) {
    return await apiFetch('/api/player/grantreward', {
      method: 'POST',
      ...jsonBody({ type, amount }),
    });
  },

  // ── Heroes ──────────────────────────────────────────────────────────

  async getHeroes() {
    return (await apiFetch('/api/heroes')) || [];
  },

  async getHero(id) {
    return await apiFetch(`/api/hero/${encodeURIComponent(id)}`);
  },

  // ── Clans ───────────────────────────────────────────────────────────

  async getClans() {
    return (await apiFetch('/api/clans')) || [];
  },

  async getClan(id) {
    return await apiFetch(`/api/clan/${encodeURIComponent(id)}`);
  },

  // ── Kingdoms ────────────────────────────────────────────────────────

  async getKingdoms() {
    return (await apiFetch('/api/kingdoms')) || [];
  },

  async getKingdom(id) {
    return await apiFetch(`/api/kingdom/${encodeURIComponent(id)}`);
  },

  // ── Settlements ─────────────────────────────────────────────────────

  async getSettlements() {
    return (await apiFetch('/api/settlements')) || [];
  },

  async getSettlement(id) {
    return await apiFetch(`/api/settlement/${encodeURIComponent(id)}`);
  },

  // ── Descriptions ────────────────────────────────────────────────────

  async getAllDescriptions() {
    return (await apiFetch('/api/descriptions')) || {};
  },

  async getDescriptionCount() {
    return (await apiFetch('/api/descriptions/count')) || { count: 0 };
  },

  async getDescription(id) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/description`);
  },

  async setDescription(id, text) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/description`, {
      method: 'PUT',
      ...jsonBody({ text }),
    });
  },

  // ── Lore Fields ─────────────────────────────────────────────────────

  async getLoreField(heroId, fieldKey) {
    return await apiFetch(
      `/api/hero/${encodeURIComponent(heroId)}/field/${encodeURIComponent(fieldKey)}`
    );
  },

  async setLoreField(heroId, fieldKey, text) {
    return await apiFetch(
      `/api/hero/${encodeURIComponent(heroId)}/field/${encodeURIComponent(fieldKey)}`,
      {
        method: 'PUT',
        ...jsonBody({ text }),
      }
    );
  },

  async getAllLoreFields() {
    return (await apiFetch('/api/lore-fields')) || {};
  },

  async getLoreFieldKeys() {
    return (await apiFetch('/api/lore-fields/keys')) || [];
  },

  async getHeroLore(heroId) {
    return (await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/lore`)) || {};
  },

  // ── Tags ────────────────────────────────────────────────────────────

  async getAllTags() {
    return (await apiFetch('/api/tags')) || {};
  },

  async getTagCount() {
    return (await apiFetch('/api/tags/count')) || { count: 0 };
  },

  async getUniqueTags() {
    return (await apiFetch('/api/tags/unique')) || [];
  },

  async getEntityTags(id) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/tags`);
  },

  async setEntityTags(id, tags) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/tags`, {
      method: 'PUT',
      ...jsonBody({ tags }),
    });
  },

  // ── Journal ─────────────────────────────────────────────────────────

  async getAllJournal() {
    return (await apiFetch('/api/journal')) || {};
  },

  async getJournalCount() {
    return (await apiFetch('/api/journal/count')) || { count: 0 };
  },

  async getEntityJournal(id) {
    return (await apiFetch(`/api/entity/${encodeURIComponent(id)}/journal`)) || [];
  },

  async addJournalEntry(id, text) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/journal`, {
      method: 'POST',
      ...jsonBody({ text }),
    });
  },

  // ── Relation Notes ──────────────────────────────────────────────────

  async getAllRelationNotes() {
    return (await apiFetch('/api/relation-notes')) || {};
  },

  async getRelationNoteCount() {
    return (await apiFetch('/api/relation-notes/count')) || { count: 0 };
  },

  async getRelationNote(heroId, targetId) {
    return await apiFetch(
      `/api/relation-note/${encodeURIComponent(heroId)}/${encodeURIComponent(targetId)}`
    );
  },

  async setRelationNote(heroId, targetId, note) {
    return await apiFetch(
      `/api/relation-note/${encodeURIComponent(heroId)}/${encodeURIComponent(targetId)}`,
      {
        method: 'PUT',
        ...jsonBody({ note }),
      }
    );
  },

  // ── Name & Title ────────────────────────────────────────────────────

  async getEntityName(id) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/name`);
  },

  async setEntityName(id, name, title) {
    const body = {};
    if (name !== undefined) body.name = name;
    if (title !== undefined) body.title = title;
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/name`, {
      method: 'PUT',
      ...jsonBody(body),
    });
  },

  // ── Banner ─────────────────────────────────────────────────────────

  async getEntityBanner(id) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/banner`);
  },

  async setEntityBanner(id, bannerCode) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/banner`, {
      method: 'PUT',
      ...jsonBody({ banner: bannerCode }),
    });
  },

  // ── Cultures & Occupations ──────────────────────────────────────────

  async getAllCultures() {
    return (await apiFetch('/api/cultures')) || {};
  },

  async getAllOccupations() {
    return (await apiFetch('/api/occupations')) || {};
  },

  async getHeroCulture(heroId) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/culture`);
  },

  async setHeroCulture(heroId, culture) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/culture`, {
      method: 'PUT',
      ...jsonBody({ culture }),
    });
  },

  async getHeroOccupation(heroId) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/occupation`);
  },

  async setHeroOccupation(heroId, occupation) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/occupation`, {
      method: 'PUT',
      ...jsonBody({ occupation: parseInt(occupation, 10) }),
    });
  },

  // ── Stats ───────────────────────────────────────────────────────────

  async getHeroStats(heroId) {
    return (await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/stats`)) || {};
  },

  async getSettlementStats(id) {
    return (await apiFetch(`/api/settlement/${encodeURIComponent(id)}/stats`)) || {};
  },

  // ── Chronicle ───────────────────────────────────────────────────────

  async getAllChronicle() {
    return (await apiFetch('/api/chronicle')) || [];
  },

  async getHeroChronicle(heroId) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/chronicle`);
  },

  // ── Tag Categories & Presets ────────────────────────────────────────

  async getTagCategories() {
    return (await apiFetch('/api/tag-categories')) || {};
  },

  async getTagPresets() {
    return (await apiFetch('/api/tag-presets')) || {};
  },

  // ── Portraits ────────────────────────────────────────────────────────

  async uploadPortrait(heroId, file) {
    try {
      const res = await fetch(`/api/hero/${encodeURIComponent(heroId)}/portrait`, {
        method: 'POST',
        body: file,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[API] uploadPortrait', e.message);
      return null;
    }
  },

  async hasPortrait(heroId) {
    return await apiFetch(`/api/hero/${encodeURIComponent(heroId)}/portrait`);
  },

  // ── Portrait & Banner listings ──────────────────────────────────────

  async getPortraitList() {
    return (await apiFetch('/api/portraits')) || { custom: [], exported: [] };
  },

  async extractPortraits() {
    return await apiFetch('/api/extract-portraits', { method: 'POST' });
  },

  async getBannerList() {
    return (await apiFetch('/api/banners')) || [];
  },

  // ══════════════════════════════════════════════════════════════════
  // EXTENDED API — Full mod capability coverage
  // ══════════════════════════════════════════════════════════════════

  // ── Journal entry edit/delete ──────────────────────────────────────

  async replaceJournalEntry(id, index, text) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/journal`, {
      method: 'PUT',
      ...jsonBody({ index, text }),
    });
  },

  async removeJournalEntry(id, index) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/journal/${index}`, {
      method: 'DELETE',
    });
  },

  // ── Edit Timestamps ────────────────────────────────────────────────

  async getEditTimestamp(id) {
    return await apiFetch(`/api/entity/${encodeURIComponent(id)}/timestamp`);
  },

  // ── Relation History ───────────────────────────────────────────────

  async getRelationHistory(heroId, targetId) {
    return (await apiFetch(`/api/relation-history/${encodeURIComponent(heroId)}/${encodeURIComponent(targetId)}`)) || [];
  },

  async getRelationHistoryForHero(targetId) {
    return (await apiFetch(`/api/relation-history-for/${encodeURIComponent(targetId)}`)) || [];
  },

  // ── Tag Notes ──────────────────────────────────────────────────────

  async getTagNote(objectId, tag) {
    return await apiFetch(`/api/tag-note/${encodeURIComponent(objectId)}/${encodeURIComponent(tag)}`);
  },

  async setTagNote(objectId, tag, note) {
    return await apiFetch(`/api/tag-note/${encodeURIComponent(objectId)}/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      ...jsonBody({ note }),
    });
  },

  async getAllTagNotes(objectId) {
    return (await apiFetch(`/api/tag-notes/${encodeURIComponent(objectId)}`)) || {};
  },

  // ── Auto-Tag Thresholds ────────────────────────────────────────────

  async getAutoTagThreshold(heroId) {
    return await apiFetch(`/api/auto-tag-threshold/${encodeURIComponent(heroId)}`);
  },

  async setAutoTagThreshold(heroId, enemy, friend) {
    return await apiFetch(`/api/auto-tag-threshold/${encodeURIComponent(heroId)}`, {
      method: 'PUT',
      ...jsonBody({ enemy, friend }),
    });
  },

  async getAllAutoTagThresholds() {
    return (await apiFetch('/api/auto-tag-thresholds')) || {};
  },

  // ── Relation Note Tags & Locks ─────────────────────────────────────

  async getRelationNoteTag(heroId, targetId) {
    return await apiFetch(`/api/relation-note-tag/${encodeURIComponent(heroId)}/${encodeURIComponent(targetId)}`);
  },

  async setRelationNoteTag(heroId, targetId, tag, locked) {
    const body = {};
    if (tag !== undefined) body.tag = tag;
    if (locked !== undefined) body.locked = locked;
    return await apiFetch(`/api/relation-note-tag/${encodeURIComponent(heroId)}/${encodeURIComponent(targetId)}`, {
      method: 'PUT',
      ...jsonBody(body),
    });
  },

  // ── Custom Culture Definitions ─────────────────────────────────────

  async getCultureDefinitions() {
    return (await apiFetch('/api/culture-definitions')) || [];
  },

  async setCultureDefinition(cultureId, displayName, baseCultureId, basicTroopId, eliteTroopId) {
    return await apiFetch(`/api/culture-definition/${encodeURIComponent(cultureId)}`, {
      method: 'PUT',
      ...jsonBody({ displayName, baseCultureId, basicTroopId, eliteTroopId }),
    });
  },

  async removeCultureDefinition(cultureId) {
    return await apiFetch(`/api/culture-definition/${encodeURIComponent(cultureId)}`, {
      method: 'DELETE',
    });
  },

  // ── Detailed Import ────────────────────────────────────────────────

  async importDetailed() {
    return await apiFetch('/api/import-detailed', { method: 'POST' });
  },

  // ── Per-section exports ────────────────────────────────────────────

  async exportHeroes() {
    return await apiFetch('/api/export/heroes', { method: 'POST' });
  },

  async exportClans() {
    return await apiFetch('/api/export/clans', { method: 'POST' });
  },

  async exportKingdoms() {
    return await apiFetch('/api/export/kingdoms', { method: 'POST' });
  },

  async exportSettlements() {
    return await apiFetch('/api/export/settlements', { method: 'POST' });
  },

  async exportBanners() {
    return await apiFetch('/api/export/banners', { method: 'POST' });
  },

  async importBanners() {
    return await apiFetch('/api/import/banners', { method: 'POST' });
  },

  // ── Bulk tag operations ────────────────────────────────────────────

  async mergeTag(sourceTag, targetTag) {
    return await apiFetch('/api/tags/merge', {
      method: 'POST',
      ...jsonBody({ sourceTag, targetTag }),
    });
  },

  async addTagBulk(tag, ids) {
    return await apiFetch('/api/tags/add-bulk', {
      method: 'POST',
      ...jsonBody({ tag, ids: ids.join(',') }),
    });
  },

  async removeTagBulk(tag, ids) {
    return await apiFetch('/api/tags/remove-bulk', {
      method: 'POST',
      ...jsonBody({ tag, ids: ids.join(',') }),
    });
  },

  async clearAllTags() {
    return await apiFetch('/api/tags/clear-all', { method: 'POST' });
  },

  async getObjectsWithTag(tag) {
    return (await apiFetch(`/api/tags/objects/${encodeURIComponent(tag)}`)) || [];
  },

  // ── Auto-tags ──────────────────────────────────────────────────────

  async getAutoTags(objectId) {
    return await apiFetch(`/api/auto-tags/${encodeURIComponent(objectId)}`);
  },

  // ── Enhanced Statistics ────────────────────────────────────────────

  async getDetailedStatistics() {
    return (await apiFetch('/api/statistics/detailed')) || {};
  },

  // ── Shared file path ──────────────────────────────────────────────

  async getSharedFilePath() {
    return await apiFetch('/api/shared-file-path');
  },

  // ── Lore template keys ────────────────────────────────────────────

  async getLoreTemplateKeys() {
    return (await apiFetch('/api/lore-templates/keys')) || [];
  },

  // ── Purge orphans ─────────────────────────────────────────────────

  async purgeOrphans() {
    return await apiFetch('/api/purge-orphans', { method: 'POST' });
  },

  // ── Full export/import ────────────────────────────────────────────

  async exportAll() {
    return await apiFetch('/api/export', { method: 'POST' });
  },

  async importAll() {
    return await apiFetch('/api/import', { method: 'POST' });
  },

  // ── Tag rename/remove (global) ────────────────────────────────────

  async renameTagGlobal(oldTag, newTag) {
    return await apiFetch('/api/tags/rename', {
      method: 'POST',
      ...jsonBody({ oldTag, newTag }),
    });
  },

  async removeTagGlobal(tag) {
    return await apiFetch('/api/tags/remove', {
      method: 'POST',
      ...jsonBody({ tag }),
    });
  },

  async getTagUsageCounts() {
    return (await apiFetch('/api/tags/usage')) || [];
  },

  // ── Web Extension Settings ────────────────────────────────────

  async getWebSettings() {
    return (await apiFetch('/api/web-settings')) || {};
  },

  // ── Player Command Center ─────────────────────────────────────

  async getPlayerOverview() {
    return await apiFetch('/api/player/overview');
  },

  async getPlayerCharacter(heroId) {
    const q = heroId ? '?heroId=' + encodeURIComponent(heroId) : '';
    return await apiFetch('/api/player/character' + q);
  },

  async getPlayerEquipment(heroId) {
    const q = heroId ? '?heroId=' + encodeURIComponent(heroId) : '';
    return await apiFetch('/api/player/equipment' + q);
  },

  async getPlayerTroops() {
    return (await apiFetch('/api/player/troops')) || { troops: [], total: 0 };
  },

  async getPlayerPrisoners() {
    return (await apiFetch('/api/player/prisoners')) || { prisoners: [], total: 0 };
  },

  async getPlayerInventory() {
    return (await apiFetch('/api/player/inventory')) || { items: [] };
  },

  async getPlayerCompanions() {
    return (await apiFetch('/api/player/companions')) || { companions: [] };
  },

  async getPlayerSettlements() {
    return (await apiFetch('/api/player/settlements')) || { settlements: [] };
  },

  async getPlayerClan() {
    return await apiFetch('/api/player/clan');
  },

  async getPlayerKingdom() {
    return await apiFetch('/api/player/kingdom');
  },

  async getPlayerQuests() {
    return (await apiFetch('/api/player/quests')) || { active: [], completed: [] };
  },

  async equipItem(itemId, slot, equipType, heroId) {
    return await apiFetch('/api/player/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, slot, equipType: equipType || 'battle', heroId: heroId || '' })
    });
  },

  async getPlayerPerks(skillId, heroId) {
    let q = '?skillId=' + encodeURIComponent(skillId);
    if (heroId) q += '&heroId=' + encodeURIComponent(heroId);
    return (await apiFetch('/api/player/perks' + q)) || { perks: [] };
  },

  async addFocusPoint(skillId, heroId) {
    return await apiFetch('/api/player/addfocus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, heroId: heroId || '' })
    });
  },

  async selectPerk(perkId, heroId) {
    return await apiFetch('/api/player/selectperk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perkId, heroId: heroId || '' })
    });
  },

  async addAttributePoint(attribute, heroId) {
    return await apiFetch('/api/player/addattribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attribute, heroId: heroId || '' })
    });
  },

  async autoEquipBest(heroId) {
    return await apiFetch('/api/player/autoequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroId: heroId || '' })
    });
  },

  async getFiefDetail(settlementId) {
    return await apiFetch('/api/settlement/fiefdetail/' + settlementId);
  },

  async getTradeRoutes() {
    return await apiFetch('/api/player/traderoutes');
  },

  async getNotifications() {
    return await apiFetch('/api/player/notifications');
  },

  async abdicateLeadership() {
    return await apiFetch('/api/kingdom/abdicate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}'
    });
  },

  async renameKingdom(name) {
    return await apiFetch('/api/kingdom/rename', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name})
    });
  },

  async supportClan(clanId) {
    return await apiFetch('/api/kingdom/supportclan', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({clanId})
    });
  },

  async expelClan(clanId) {
    return await apiFetch('/api/kingdom/expelclan', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({clanId})
    });
  },

  async changePolicy(policyId) {
    return await apiFetch('/api/kingdom/changepolicy', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({policyId})
    });
  },

  async getAvailableArmyParties() {
    return (await apiFetch('/api/kingdom/availableparties')) || [];
  },

  async createArmy(targetSettlementId, partyIds) {
    return await apiFetch('/api/kingdom/createarmy', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({targetSettlementId, partyIds: (partyIds || []).join(',')})
    });
  },

  async kingdomDiplomacy(action, targetKingdomId) {
    return await apiFetch('/api/kingdom/diplomacy', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action, targetKingdomId})
    });
  },

  async getMap() {
    return await apiFetch('/api/map');
  },

  async travelTo(settlementId) {
    return await apiFetch('/api/player/travel', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId})
    });
  },

  async sendMemberToSettlement(settlementId, heroId) {
    return await apiFetch('/api/settlement/sendmember', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, heroId})
    });
  },

  async giftSettlement(settlementId, clanId) {
    return await apiFetch('/api/settlement/gift', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, clanId})
    });
  },

  async setProject(settlementId, buildingIndex) {
    return await apiFetch('/api/settlement/setproject', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, buildingIndex: String(buildingIndex)})
    });
  },

  async setGovernor(settlementId, heroId) {
    return await apiFetch('/api/settlement/setgovernor', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, heroId: heroId || ''})
    });
  },

  async setGarrisonWageLimit(settlementId, limit) {
    return await apiFetch('/api/settlement/setwagelimit', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, limit: String(limit)})
    });
  },

  async setAutoRecruitment(settlementId, enabled) {
    return await apiFetch('/api/settlement/setautorecruitment', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({settlementId, enabled: String(enabled)})
    });
  },

  async createParty(heroId) {
    return await apiFetch('/api/player/createparty', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({heroId})
    });
  },

  async disbandParty(heroId) {
    return await apiFetch('/api/player/disbandparty', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({heroId})
    });
  },

  async getPartyRoles() {
    return await apiFetch('/api/player/partyroles');
  },

  async assignRole(role, heroId, partyId) {
    return await apiFetch('/api/player/assignrole', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, heroId: heroId || '', partyId: partyId || '' })
    });
  },

  async getPartyRolesDetail(partyId) {
    return await apiFetch('/api/player/partyroles/detail?partyId=' + encodeURIComponent(partyId || ''));
  },

  async recruitPrisoner(troopId, count) {
    return await apiFetch('/api/player/recruitprisoner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ troopId, count: count || 1 })
    });
  },

  async disbandTroop(troopId, count) {
    return await apiFetch('/api/player/disbandtroop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ troopId, count: count || 1 })
    });
  },

  async upgradeTroop(troopId, upgradeIndex) {
    return await apiFetch('/api/player/upgradetroop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ troopId, upgradeIndex: upgradeIndex || 0 })
    });
  },

  async sellGoods(type) {
    return await apiFetch('/api/player/sellgoods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type || 'goods' })
    });
  },

  async discardItem(itemId, count) {
    return await apiFetch('/api/player/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, count: count || 1 })
    });
  },

  async trackSettlement(settlementId) {
    return await apiFetch('/api/settlement/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId })
    });
  },

  async unequipItem(slot, equipType, heroId) {
    return await apiFetch('/api/player/unequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, equipType: equipType || 'battle', heroId: heroId || '' })
    });
  },
};
