// ==UserScript==
// @name                榭洛科特工坊
// @version             0.3.75
// @author              Alk
// @license             GPL-3.0
// @description         榭洛科特工坊 -
// @match               https://*.granbluefantasy.jp/*
// @match               https://gbf.game.mbga.jp/*
// @resource            sierokarte https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf_custom.css?v=3
// @grant               GM_getResourceText
// @grant               GM_addStyle
// @run-at              document-start
// @namespace           https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @icon                https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/sierokarte.png?v=2
// @downloadURL         https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @updateURL           https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @supportURL          https://www.neko-tail.wang/
// @homepageURL         https://www.neko-tail.wang/
// ==/UserScript==

// region FULL CODE
(function () {
    'use strict';

    const version = '0.3.75';

    let is_script_paused = false;
    let pause_toast = null;
    let last_xhr_time = Date.now();

    const defaults = {
        refresh: {
            use_back: false, attack: true, summon: false, ability: false,
            keywords: [
                { id: 'koenig_dekret', enabled: false, keys: ['ケーニヒ・ベシュテレン'] },
                { id: 'coronal_ejection', enabled: false, keys: ['火属性ダメージ/3番目までに配置された火属性キャラがターン進行時に攻撃行動を２回行う'] },
                { id: 'secret_triad', enabled: false, keys: ['シークレットトライアド'] },
                { id: 'yatima', enabled: false, keys: ['ヤチマ'] },
                { id: 'two_platoons', enabled: false, keys: ['ツープラトン'] },
                { id: 'war_eternal', enabled: false, keys: ['ウォー・エターナル＋'] },
                { id: 'hundred_year_lapis_brilliance', enabled: false, keys: ['百年瑠璃光＋'] },
                { id: 'transcendent_blue', enabled: false, keys: ['アセンダンス・ブルー'] }
            ]
        },
        danger_mode: {
            enabled: false, filtering: false, filtering_by_asc: true, enable_layout_change: false,
            earth_hunting: false, hp_refresh_at_10: false, auto_enter: false, auto_raid_select: false,
            auto_auto: false, auto_skip_scene: false, auto_summon: false, auto_potion: false,
            auto_summon_prefer: '', hp_less_than: 50, member_more_than: 5, contribution: 1800000,
            sub_options: ['filtering', 'filtering_by_asc', 'auto_auto']
        },
        redirect: { enabled: false, assist: '#quest/assist', current: '' },
        delay: { factors: [125, 125, 125], ratio: { normal: 3, hunt: 1 } },
        set: ['normal_attack_result.json', 'ability_result.json', 'fatal_chain_result.json', 'summon_result.json'],
        bookmark: { enabled: false, bookmarks: [] },
        option: {
            force_pause: false, enable_touch_mode: false, enable_scroller: true, enable_drop_notify: true,
            enable_hide_left_sidebar: true, enable_hide_right_sidebar: true, warning_audio: 3
        },
    };

    class Config {
        constructor(key, defaults) {
            this.key = key; this.defaults = defaults; this.state = {...defaults, ...this._read()};
        }
        _read() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } }
        _save() { localStorage.setItem(this.key, JSON.stringify(this.state)); }
        get(k) { return k in this.state ? this.state[k] : this.defaults[k]; }
        set(k, v) { this.state[k] = v; this._save(); }
        toggle(k) { this.set(k, !this.get(k)); }
    }

    const C = new Config('sierokarte', defaults);
    const config = C.state;

    if (config.option.force_pause) is_script_paused = true;

    const icon_url = {
        mine: 'https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/sierokarte.png?v=2',
        gold_brick: 'https://gbf.wiki/images/5/5b/Gold_Brick_square.jpg',
    };

    let uid = 0;

    const isTamperMonkeyEnvironment = typeof GM_getResourceText !== 'undefined';
    if (isTamperMonkeyEnvironment) {
        const css = GM_getResourceText('sierokarte');
        GM_addStyle(css);
    }

    GM_addStyle(`
        details.panel-group {
            border: 1px solid #ccc;
            border-radius: 4px;
            margin: 8px 0;
            padding: 4px;
            background: #fafafa;
        }
        details.panel-group summary {
            cursor: pointer;
            font-weight: bold;
            color: #2a52be;
            outline: none;
            padding: 4px;
            user-select: none;
            font-size: 1.1em;
            text-align: center;
        }
        details.panel-group[open] summary {
            border-bottom: 1px solid #eee;
            margin-bottom: 8px;
        }
    `);

    const utils = {
        cloud: { write_battle_log: async () => {}, read_battle_log: async () => [] },
        danger_actions: {
            async enter_raid() {
                if (is_script_paused) return;
                const PRI = '.btn-usual-ok.se-quest-start', SEC = '.btn-usual-ok.btn-silent-se';
                const opts = {interval: 550, timeout: 550};
                let sel = null;
                try { sel = await utils.tools.waitForQ(PRI, utils.tools.isVisibleNow, opts); } 
                catch {
                    try { sel = await utils.tools.waitForQ(SEC, utils.tools.isVisibleNow, opts); } 
                    catch { setTimeout(utils.danger_actions.enter_raid, 500); return; }
                }
                try {
                    let n = 0;
                    while (n < 50 && !is_script_paused) {
                        await utils.tools.smartClick(sel); n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        if (!document.body.contains(sel) || !utils.tools.isVisibleNow(sel)) break;
                        else if (document.querySelector('#pop-c-a-i')?.children.length > 0 || document.querySelector('input[placeholder*="認証文字"]') !== null) break;
                    }
                } catch (e) {
                    utils.tools.ensureBtnObserver(async (b) => { await utils.tools.smartClick(b); });
                    setTimeout(utils.danger_actions.enter_raid, 500);
                }
            },
            async skip_scene() {
                if (is_script_paused || !utils.urls.is_scene()) return;
                try {
                    await utils.tools.waitForQ('.btn-skip', utils.tools.isVisibleNow, { interval: 550, timeout: 550 });
                    let n = 0;
                    while (n < 20 && !is_script_paused) {
                        const target = document.querySelector('.btn-skip');
                        if (!target) break;
                        await utils.tools.smartClick(target); n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        const skip_btn = document.querySelector('.btn-scene-skip');
                        if (document.body.contains(skip_btn) || utils.tools.isVisibleNow(skip_btn)) break;
                    }
                    n = 0;
                    while (n < 20 && !is_script_paused) {
                        const confirm = document.querySelector('.btn-scene-skip');
                        if (!confirm) break;
                        await utils.tools.smartClick(confirm); n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        if (!document.body.contains(confirm) || !utils.tools.isVisibleNow(confirm)) break;
                    }
                } catch (e) {
                    utils.tools.ensureBtnObserver(async (b) => { await utils.tools.smartClick(b); });
                    setTimeout(utils.danger_actions.skip_scene, 500);
                }
            },
            async tap_auto() {
                if (is_script_paused || (!utils.urls.is_raid() && !utils.urls.is_multi_raid())) return;
                try {
                    await utils.tools.waitForQ('.prt-start-direction', utils.tools.isVisibleNow, { interval: 550, timeout: 550 });
                    let n = 0;
                    while (n < 25 && !is_script_paused) {
                        const start_dir = document.querySelector('.prt-start-direction');
                        if (!start_dir || start_dir?.style?.display === 'none') break;
                        const black_bg = document.querySelector('.prt-black-bg');
                        if (!black_bg) break;
                        await utils.tools.smartClick(black_bg); n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        const btn_ready_auto = document.querySelector('.btn-ready-auto.anim-simple-fadein');
                        if (document.body.contains(btn_ready_auto) || utils.tools.isVisibleNow(btn_ready_auto)) break;
                    }
                } catch (e) {
                    utils.tools.ensureBtnObserver(async (b) => { await utils.tools.smartClick(b); });
                    setTimeout(utils.danger_actions.tap_auto, 500);
                }
            },
            async select_item(selector) {
                document.querySelectorAll(selector).forEach((i, idx) => { utils.tools.smartClick(i, idx); });
            },
            async tap_summon() {
                if (is_script_paused || (!utils.urls.is_raid() && !utils.urls.is_multi_raid())) return;
                try {
                    const btn = await utils.tools.waitForQ('#js-btn-quick-summon', utils.tools.isVisibleNow, { interval: 550, timeout: 550 });
                    if (!btn.classList.contains('qs-recast') || btn.classList.contains('qs-disable')) return;
                    const try_click = async function () {
                        let n = 0;
                        while (n < 5 && !is_script_paused) {
                            const summon_list_btn = document.querySelector('.btn-command-summon');
                            const raw = document.querySelector('.prt-summon-list').querySelectorAll('.btn-summon-available');
                            const targets = utils.tools.sortBySummonCodeOrder(raw, config.danger_mode.auto_summon_prefer);
                            if (!targets || targets.length === 0) return;
                            let target = targets[0];
                            if (target.getAttribute('summon-code') === '2040425000') {
                                const djeeta = document.querySelector('.lis-character0.btn-command-character');
                                const feather_enough = djeeta.querySelector('[data-status="7743_12"]') !== null;
                                const is_available_for_000 = target.getAttribute('summon-require') === '9' || feather_enough;
                                if (!is_available_for_000 && targets.length === 1) target = null;
                                else if (!is_available_for_000 && targets.length > 1) target = targets[1];
                            }
                            if (target === null) return;
                            await utils.tools.smartClick(summon_list_btn);
                            await new Promise(resolve => setTimeout(resolve, 250 + utils.random()));
                            await utils.tools.smartClick(target);
                            await new Promise(r => setTimeout(r, 250 + utils.random()));
                            const skip_btn = await utils.tools.waitForQ('.btn-usual-ok.btn-summon-use', utils.tools.isVisibleNow);
                            n++;
                            if (skip_btn) { await utils.tools.smartClick(skip_btn); break; }
                        }
                    }
                    await try_click();
                } catch (e) {
                    utils.tools.ensureBtnObserver(async (b) => { await utils.tools.smartClick(b); });
                    setTimeout(utils.danger_actions.tap_summon, 500);
                }
            },
            async select_raid() {
                if (is_script_paused) return;
                
                const check_raid = async () => {
                    if (is_script_paused) return;
                    
                    const raid_list = document.querySelectorAll(`.btn-multi-raid.lis-raid.search[data-quest-id]`);
                    if (raid_list.length === 0) {
                        const refresh_btn = document.querySelector(".btn-search-refresh") || document.querySelector(".prt-search-header .btn-usual-ok") || document.querySelector(".btn-search-refresh img");
                        if (refresh_btn) {
                            await utils.tools.smartClick(refresh_btn);
                            await new Promise(r => setTimeout(r, 500 + utils.random()));
                            return check_raid();
                        } else {
                            await new Promise(r => setTimeout(r, 1000));
                            return check_raid();
                        }
                    } else {
                        await utils.tools.smartClick(raid_list[0]);
                    }
                };
                await check_raid();
            },
        },
        elements: { body: null, contribution: null },
        handle: (scenario, urlKey) => {
            if (is_script_paused || typeof scenario.find !== 'function') return;
            const winObj = scenario.find(o => o['cmd'] === 'win');
            if (scenario.find(o => o['cmd'] === 'lose')) {
                setTimeout(() => { utils.redirect.goto({ hash: '#quest/assist', force: true }); }, 1000);
                return; 
            }
            const winStatus = winObj ? (winObj['is_last_raid'] === 1 ? 'raid' : 'battle') : 'continue';
            if (winStatus === 'raid') utils.redirect.reload();
            if (winStatus === 'battle') utils.redirect.goto({ hash: '#quest/stage' });

            const is_normal_attack = urlKey === config.set[0];
            const is_ability = urlKey === config.set[1];
            const is_summon = urlKey === config.set[3];
            const is_ability_or_summon = is_ability || is_summon;

            if (config.danger_mode.auto_summon === true && is_summon === true) utils.redirect.reload();

            const do_attack_reload = () => {
                if (is_script_paused) return;
                if (config.danger_mode.earth_hunting) setTimeout(() => { utils.redirect.reload(); }, 10000);
                else utils.redirect.reload();
            };

            if (is_normal_attack && config.refresh.attack === true) do_attack_reload();
            if (is_summon && config.refresh.summon === true) do_attack_reload();
            if (is_ability && config.refresh.ability === true) do_attack_reload();

            if (is_ability_or_summon) {
                const actions = scenario.filter(o => o['cmd'] === 'ability' || o['cmd'] === 'summon');
                if (actions.length > 0) {
                    const names = actions.map(o => o.name);
                    config.refresh.keywords.some((item) => {
                        if (item.enabled && names.some(n => item.keys.includes(n))) do_attack_reload();
                    })
                }
            }
        },
        handle_list: (arr) => arr.map(r => {
            const hp = Number(r.boss_hp_width), mc = Number(r.member_count);
            return {r, key: hp >= 80 ? [0, mc, -hp] : [1, -hp, mc]};
        }).filter(x => x.r.boss_hp_width >= config.danger_mode.hp_less_than && x.r.member_count <= config.danger_mode.member_more_than)
          .sort((x, y) => { for (let i = 0; i < x.key.length; i++) { const d = x.key[i] - y.key[i]; if (d !== 0) return d; } return 0; })
          .map(x => x.r),
        info: { auto_click_start_try_dt: null, contribution: 0, turn: 0, auto_enabled: false, member: 0, boss_gauge: 0, one_click_enhance: { bookmark: '' } },
        inject: () => {
            const {urls, elements} = utils;
            utils.ui.unload_panel();

            if (config.option.force_pause) {
                is_script_paused = true;
                if (!pause_toast) {
                    pause_toast = document.createElement('div');
                    pause_toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(220, 38, 38, 0.95); color:white; padding:12px 24px; border-radius:8px; z-index:999999; font-size:18px; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none;";
                    pause_toast.textContent = "⚠️ 脚本已暂停运行 (Ctrl+Shift+X 恢复)";
                    document.body.appendChild(pause_toast);
                }
                pause_toast.style.display = 'block';
            } else {
                is_script_paused = false;
                if (pause_toast) pause_toast.style.display = 'none';
            }

            elements.body = document.querySelector('body');
            elements.body?.classList?.add('sierokarte');
            if (config.danger_mode.enable_layout_change) elements.body.classList.add('styled');
            if (urls.is_home() && config.danger_mode.enable_layout_change) elements.body.classList.add('home');
            if (config.option.enable_hide_left_sidebar) elements.body.classList.add('no-left-sidebar');
            if (config.option.enable_hide_right_sidebar) elements.body.classList.add('no-right-sidebar');
            if (config.option.enable_touch_mode) elements.body.classList.add('touch');

            const panel = document.querySelector('.panel-container');
            if (panel) panel.remove();
            const bookmark = document.querySelector('.bookmark');
            if (bookmark) bookmark.remove();
            const footer = document.querySelector('.siero-footer');
            if (footer) footer.remove();
            
            utils.panel.create(C, defaults);

            setTimeout(() => { document.querySelectorAll('img').forEach(image => { image.draggable = false; }) }, 1000)

            setInterval(() => {
                if (is_script_paused || config.option.force_pause || urls.is_home()) return;
                if (Date.now() - last_xhr_time > 30000) {
                    last_xhr_time = Date.now();
                    location.reload();
                }
            }, 5000);

            if (urls.is_raid() || urls.is_multi_raid()) {
                if (config.danger_mode.auto_auto) setTimeout(utils.danger_actions.tap_auto, 300);
                if (config.danger_mode.auto_summon) setTimeout(utils.danger_actions.tap_summon, 300);
                utils.safe_actions.watch.enemyHP(utils.redirect.reload);
                utils.safe_actions.watch.bossDown(utils.redirect.reload);
                utils.safe_actions.watch.errorPop(utils.redirect.reload);
                utils.safe_actions.watch.captcha(async () => { await utils.safe_actions.play.warning(); });
                utils.safe_actions.watch.potion();
                if (config.danger_mode.auto_raid_select === true) utils.safe_actions.watch.contribution(utils.redirect.assist);
            }

            if (urls.is_spsl() && config.danger_mode.auto_enter) utils.danger_actions.enter_raid();
            if (urls.is_scene() && config.danger_mode.auto_skip_scene) utils.danger_actions.skip_scene();
            if (urls.is_quest() && config.danger_mode.auto_raid_select) utils.danger_actions.select_raid();
        },
        onLoad: () => {
            clearAllTimers();
            utils.inject();
            if (!utils.urls.is_home()) {
                document.body?.classList?.remove('home');
                document.body?.classList?.remove('clean');
            }
            utils.redirect.auto();
            if (config.option.enable_scroller) utils.tools.register_scroller();
        },
        panel: {
            create: (cfg, defaultsObj) => {
                const getByPath = (obj, path) => path.replace(/\[(\d+)]/g, '.$1').split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
                const setByPath = (obj, path, val) => {
                    const segs = path.replace(/\[(\d+)]/g, '.$1').split('.');
                    let cur = obj;
                    for (let i = 0; i < segs.length - 1; i++) {
                        const k = segs[i];
                        if (!(k in cur) || typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
                        cur = cur[k];
                    }
                    cur[segs[segs.length - 1]] = val;
                };

                const getKeywordEnabled = (id) => {
                    const item = (cfg.state.refresh?.keywords || []).find(it => it.id === id);
                    return !!(item && item.enabled);
                };
                const setKeywordEnabled = (id, enabled) => {
                    const arr = cfg.state.refresh?.keywords || [];
                    const idx = arr.findIndex(it => it.id === id);
                    if (idx >= 0) arr[idx].enabled = !!enabled;
                    else {
                        (cfg.state.refresh || (cfg.state.refresh = {}));
                        (cfg.state.refresh.keywords || (cfg.state.refresh.keywords = []));
                        cfg.state.refresh.keywords.push({id, enabled: !!enabled, keys: []});
                    }
                    cfg._save();
                };

                const FIELDS = [
                    // 【猎金与风险设置】(默认展开)
                    { group: '猎金与风险设置', key: 'auto_raid_select', label: '<span style="color: gold;">⚠开启猎金模式</span>', desc: '自动进入首个大巴副本', type: 'bool', path: 'danger_mode.auto_raid_select', cls: 'danger', danger_mode: true },
                    { group: '猎金与风险设置', key: 'auto_raid_contribution', label: '⚠猎金模式贡献阈值', desc: '超过阈值时自动退出副本至副本选择界面', type: 'text', path: 'danger_mode.contribution', cls: 'danger', danger_mode: true },
                    { group: '猎金与风险设置', key: 'earth_hunting', label: '⚠土属性猎金(延迟10秒刷新)', desc: '土奥义队专属：勾选后，在攻击/技能/召唤触发的刷新时，脚本会等待10秒再刷新，避免内置CD带到下一个BOSS。结算刷新不受影响。', type: 'bool', path: 'danger_mode.earth_hunting', cls: 'danger', danger_mode: true },
                    { group: '猎金与风险设置', key: 'hp_refresh_at_10', label: '⚠BOSS血量低于5%自动刷新', desc: '当BOSS血量剩余5%及以下（但未死亡）时，脚本自动触发刷新。通常用于放弃残血BOSS去抢下一只。', type: 'bool', path: 'danger_mode.hp_refresh_at_10', cls: 'danger', danger_mode: true },
                    { group: '猎金与风险设置', key: 'enable_filter', label: '⚠开启筛选模式', desc: '允许过滤剩余血量过低，或参战人数过多的救援。', type: 'bool', path: 'danger_mode.filtering', cls: 'danger', danger_mode: true },
                    { group: '猎金与风险设置', key: 'filter_by_asc', label: '⚠血量排序(升序)', desc: '筛选模式下，根据血量低在前进行排序。', type: 'bool', path: 'danger_mode.filtering_by_asc', cls: 'danger', danger_mode: true },

                    // 【全自动挂机】(默认展开)
                    { group: '全自动挂机', key: 'enable_auto_farm_switch', label: '<span style="color: gold;">⚠一键副本切换(点击+进本)</span>', desc: '勾选此选项将同时开启下方的【启用自动点击】和【启用自动进入副本】；取消勾选则同时关闭。', type: 'bool', get: () => !!(config.danger_mode.auto_auto && config.danger_mode.auto_enter), set: (v) => { config.danger_mode.auto_auto = v; config.danger_mode.auto_enter = v; cfg._save(); }, cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'enable_auto_click', label: '⚠启用自动点击', desc: '允许在进入副本后开启自动战斗。现处于测试模式，在游戏背景过亮的情况下会导致计算失效。', type: 'bool', path: 'danger_mode.auto_auto', cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'enable_auto_enter', label: '⚠启用自动进入副本', desc: '允许在召唤石选择界面自动进入副本。', type: 'bool', path: 'danger_mode.auto_enter', cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'enable_auto_skip_scene', label: '⚠启用自动跳过剧情', desc: '允许在触发剧情时自动跳过剧情。', type: 'bool', path: 'danger_mode.auto_skip_scene', cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'auto_potion', label: '⚠启动自动喝药', desc: '主角血量低于30%时，自动使用绿药。', type: 'bool', path: 'danger_mode.auto_potion', cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'enable_auto_summon', label: '⚠启用自动使用召唤', desc: '允许在开启自动使用召唤时，按顺序自动使用召唤', type: 'bool', path: 'danger_mode.auto_summon', cls: 'danger', danger_mode: true },
                    { group: '全自动挂机', key: 'auto_summon_prefer', label: '⚠自动召唤优先顺序', desc: '自动召唤会按照优先顺序依次释放，不在该顺序列表中的将从前到后释放', type: 'text', path: 'danger_mode.auto_summon_prefer', cls: 'danger', danger_mode: true },

                    // 【刷新规则】(默认折叠)
                    { group: '刷新规则', key: 'refresh_attack', label: '♼普通攻击', desc: '允许在普通攻击发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', path: 'refresh.attack', cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_summon', label: '♼使用任意召唤', desc: '允许在使用任意召唤石发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', path: 'refresh.summon', cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_ability', label: '♼使用任意技能', desc: '允许在使用任意技能发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', path: 'refresh.ability', cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_koenig_dekret', label: '♼帝王法令', desc: '允许在帝王法令*（限定炎帝3技能）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('koenig_dekret'), set: (v) => setKeywordEnabled('koenig_dekret', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_coronal_ejection', label: '♼日冕喷发', desc: '允许在日冕喷发*（太阳召唤石）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('coronal_ejection'), set: (v) => setKeywordEnabled('coronal_ejection', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_secret_triad', label: '♼万事皆三', desc: '允许在万事皆三（魔导三环）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('secret_triad'), set: (v) => setKeywordEnabled('secret_triad', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_yatima', label: '♼雅琪玛', desc: '允许在【雅琪玛】【召唤】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('yatima'), set: (v) => setKeywordEnabled('yatima', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_two_platoons', label: '♼双打', desc: '允许在双打【相扑】【技能】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('two_platoons'), set: (v) => setKeywordEnabled('two_platoons', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_war_eternal', label: '♼无尽战争', desc: '允许在无尽战争【伊尔莎】/【教官】【暗】【1】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('war_eternal'), set: (v) => setKeywordEnabled('war_eternal', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_hundred_year_lapis_brilliance', label: '♼百年琉璃光', desc: '允许在百年琉璃光【拜修拉】/【药师】【土】【1】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('hundred_year_lapis_brilliance'), set: (v) => setKeywordEnabled('hundred_year_lapis_brilliance', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'refresh_transcendent_blue', label: '♼超越极限之蓝', desc: '允许在超越极限之蓝【姬塔】/【古兰】【提供：欧罗罗伽亚】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。', type: 'bool', get: () => getKeywordEnabled('transcendent_blue'), set: (v) => setKeywordEnabled('transcendent_blue', v), cls: 'refresh' },
                    { group: '刷新规则', key: 'replace_refresh_with_back', label: '🙀刷新替换为后退', desc: '允许在触发刷新时替换为后退操作。在后退代替刷新时有可能导致游戏框架重载失败，这是游戏架构问题，反复遇到时请关闭该选项。', type: 'bool', path: 'refresh.use_back', cls: 'options' },

                    // 【延迟参数】(默认折叠)
                    { group: '延迟参数', key: 'random_factor_1', label: '随机数1', desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。', type: 'number', path: 'delay.factors[0]', cls: 'params' },
                    { group: '延迟参数', key: 'random_factor_2', label: '随机数2', desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。', type: 'number', path: 'delay.factors[1]', cls: 'params' },
                    { group: '延迟参数', key: 'random_factor_3', label: '随机数3', desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。', type: 'number', path: 'delay.factors[2]', cls: 'params' },
                    { group: '延迟参数', key: 'normal_mode_ratio', label: '普通模式延迟参数', desc: '生成随机延迟的倍率。', type: 'number', path: 'delay.ratio.normal', cls: 'params' },
                    { group: '延迟参数', key: 'danger_mode_ratio', label: '⚠风险模式延迟参数', desc: '生成随机延迟的倍率。', type: 'number', path: 'delay.ratio.hunt', cls: 'params danger' },

                    // 【配置选项】(默认折叠)
                    { group: '配置选项', key: 'enable_layout_change', label: '🙀允许变更游戏风格', desc: '允许对游戏进行额外CSS加载。默认加载工坊CSS。', type: 'bool', path: 'danger_mode.enable_layout_change', cls: 'stylish' },
                    { group: '配置选项', key: 'enable_touch_mode', label: '🙀使用触屏模式', desc: '使用方便触摸的风格。', type: 'bool', path: 'option.enable_touch_mode', cls: 'stylish' },
                    { group: '配置选项', key: 'enable_drop_notify', label: '⏺️允许掉落提示', desc: '允许在掉落稀有道具*（绯绯色金/沙漏）时进行通知。', type: 'bool', path: 'option.enable_drop_notify', cls: 'options' },
                    { group: '配置选项', key: 'enable_hide_left_sidebar', label: '️⏺️关闭左侧边栏', desc: '允许在非风格模式下关闭左侧边栏。', type: 'bool', path: 'option.enable_hide_left_sidebar', cls: 'options' },
                    { group: '配置选项', key: 'enable_hide_right_sidebar', label: '️⏺️关闭右侧边栏', desc: '允许在非风格模式下关闭右侧边栏。', type: 'bool', path: 'option.enable_hide_right_sidebar', cls: 'options' },
                    { group: '配置选项', key: 'enable_scroller', label: '️⏺️允许拖拽操作', desc: '允许桌面版使用拖拽来进行页面滚动操作。', type: 'bool', path: 'option.enable_scroller', cls: 'options' },
                    { group: '配置选项', key: 'enable_bookmark', label: '✈允许书签', desc: '允许启用书签插件。书签插件将在窗口最右侧创建书签列，允许快速跳转。', type: 'bool', path: 'bookmark.enabled', cls: 'redirect' },
                    { group: '配置选项', key: 'allow_auto_redirect', label: '✈允许跳过结算', desc: '允许在进入结算页面时跳转到指定页面。', type: 'bool', path: 'redirect.enabled', cls: '' },
                    { group: '配置选项', key: 'auto_redirect_hash', label: '✈跳转对象', desc: '跳过结算时的跳转对象链接', type: 'text', path: 'redirect.current', cls: '' }
                ];

                const createBtn = (text, position = 1, callback) => {
                    const btn = document.createElement('div');
                    btn.textContent = text; btn.classList.add('floating');
                    btn.style.bottom = `${(1.5 + (position - 1) * 4)}rem`;
                    btn.addEventListener('click', callback);
                    document.body.appendChild(btn);
                    return btn;
                }

                createBtn('⚙', 1, async () => {
                    panel_container.classList.toggle('deactivated');
                    if (panel_container.classList.contains('hidden')) panel_container.classList.remove('hidden');
                    await utils.safe_actions.print.ensure_permission();
                });
                
                if (utils.urls.is_bonus_stock() || utils.urls.is_recycle() || utils.urls.is_decompose()) {
                    createBtn('☑', 2, () => { utils.danger_actions.select_item('.btn-item' + (utils.urls.is_recycle() || utils.urls.is_decompose() ? '[data-ico-ex-skill]' : '')).then(() => {}); })
                }
                if (utils.urls.is_present()) {
                    createBtn('⚔️', 3, async () => { await utils.tools.smartClick(document.querySelector('.btn-recycle.weapon.btn-order-recycle')) });
                    createBtn('🧙', 2, async () => { await utils.tools.smartClick(document.querySelector('.btn-recycle.summon.btn-order-recycle')) });
                }
                if (utils.urls.is_weapon_list()) {
                    createBtn('☑', 2, async () => { utils.info.one_click_enhance = { bookmark: location.href }; location.href = utils.tools.getEnhanceURL(); })
                }
                if (utils.urls.is_enhance()) {
                    createBtn('🥤', 2, async () => { await utils.tools.smartClick(document.querySelector('#sub_contents > div.cnt-list-equipment > div.prt-tab-content.active > div > div > div.prt-order-middle > div > div > div:nth-child(1)')) })
                }
                if (utils.urls.is_material_select()) {
                    const use = createBtn('⭕️', 2, async () => {
                        await utils.tools.smartClick(document.querySelector('#sub_contents > div.cnt-material > div.prt-enhance-detail.prt-module-enhancement > div.prt-order-bottom > div > div.btn-use-item'))
                        use.remove();
                        createBtn('🔙', 2 , async () => {
                            if (utils.info.one_click_enhance.bookmark !== '') { location.href = utils.info.one_click_enhance.bookmark; utils.info.one_click_enhance.bookmark = ''; }
                        })
                    })
                }

                const panel = document.createElement('div');
                panel.classList.add('config-panel');
                const title = document.createElement('div');
                const titleText = document.createElement('div');
                const titleIcons = document.createElement('div');
                const titleClose = document.createElement('div');
                const titleReset = document.createElement('div');
                
                titleIcons.classList.add('panel-icon-group');
                titleReset.classList.add('panel-icon');
                titleClose.classList.add('panel-icon');
                titleClose.textContent = '✖';
                titleClose.addEventListener('click', () => { panel_container.classList.toggle('deactivated'); })
                titleReset.textContent = '❕️'
                titleReset.title = '重置当前配置（※适用于有功能处于失效时）';
                titleReset.addEventListener('click', () => { localStorage.clear(); location.reload(); })
                titleText.textContent = '榭洛工坊 v' + version;
                title.classList.add('panel-title');
                title.appendChild(titleText);
                title.appendChild(titleIcons);
                titleIcons.appendChild(titleReset);
                titleIcons.appendChild(titleClose);
                panel.appendChild(title);

                const reloadRow = document.createElement('div');
                reloadRow.classList.add('panel-reload');
                const reloadLabel = document.createElement('label');
                reloadLabel.setAttribute('for', 'reloadInput');
                reloadLabel.textContent = '修改配置后立即刷新';
                reloadLabel.classList.add('panel-label');
                const reloadInput = document.createElement('input');
                reloadInput.type = 'checkbox'; reloadInput.checked = true; reloadInput.id = 'reloadInput';
                reloadRow.appendChild(reloadLabel); reloadRow.appendChild(reloadInput);
                panel.appendChild(reloadRow);
                utils.ui.separator.create(panel);

                const forcePauseRow = document.createElement('div');
                forcePauseRow.classList.add('panel-row', 'bold');
                const fpLabel = document.createElement('label');
                fpLabel.classList.add('panel-label');
                fpLabel.textContent = '⚠强制停止脚本(按 Ctrl+Shift+X 切换)';
                fpLabel.title = '勾选此项可立刻停止脚本的所有自动化操作，并清理倒计时。你也可以使用快捷键 Ctrl+Shift+X 来快速切换。';
                const fpInput = document.createElement('input');
                fpInput.type = 'checkbox'; fpInput.id = 'force_pause_id'; fpInput.checked = config.option.force_pause;
                fpLabel.setAttribute('for', 'force_pause_id');
                fpInput.addEventListener('change', () => {
                    config.option.force_pause = fpInput.checked; cfg._save();
                    is_script_paused = fpInput.checked;
                    if (is_script_paused) {
                        clearAllTimers();
                        if (!pause_toast) {
                            pause_toast = document.createElement('div');
                            pause_toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(220, 38, 38, 0.95); color:white; padding:12px 24px; border-radius:8px; z-index:999999; font-size:18px; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none;";
                            pause_toast.textContent = "⚠️ 脚本已暂停运行 (Ctrl+Shift+X 恢复)";
                            document.body.appendChild(pause_toast);
                        }
                        pause_toast.style.display = 'block';
                    } else {
                        if (pause_toast) pause_toast.style.display = 'none';
                        utils.inject();
                    }
                });
                forcePauseRow.appendChild(fpLabel);
                forcePauseRow.appendChild(fpInput);
                panel.appendChild(forcePauseRow);

                const riskRow = document.createElement('div');
                riskRow.classList.add('panel-row', 'danger', 'bold');
                const riskLabel = document.createElement('label');
                riskLabel.classList.add('panel-label');
                riskLabel.textContent = '⚠允许风险模式';
                riskLabel.title = '允许启用风险模式。非风险模式下，工坊不会对游戏进行直接操作或修改表现方式。';
                const riskInput = document.createElement('input');
                riskInput.type = 'checkbox';
                riskInput.checked = !!config.danger_mode.enabled;
                riskInput.addEventListener('change', () => {
                    config.danger_mode.enabled = riskInput.checked;
                    C._save();
                    if (reloadInput.checked) location.reload();
                });
                riskRow.appendChild(riskLabel);
                riskRow.appendChild(riskInput);
                panel.appendChild(riskRow);

                utils.ui.separator.create(panel);

                const expandRow = document.createElement('div');
                expandRow.classList.add('panel-row', 'bold');
                const expandLabel = document.createElement('label');
                expandLabel.classList.add('panel-label');
                expandLabel.textContent = '一键展开/折叠';
                const expandInput = document.createElement('input');
                expandInput.type = 'checkbox';
                expandInput.checked = false; 
                expandInput.addEventListener('change', () => {
                    const detailsList = panel.querySelectorAll('details.panel-group');
                    detailsList.forEach(d => {
                        if (expandInput.checked) d.setAttribute('open', '');
                        else d.removeAttribute('open');
                    });
                });
                expandRow.appendChild(expandLabel);
                expandRow.appendChild(expandInput);
                panel.appendChild(expandRow);

                utils.ui.separator.create(panel);

                let currentDetails = null;
                let currentGroup = '';

                FIELDS.forEach(field => {
                    if (field.group !== currentGroup) {
                        currentDetails = document.createElement('details');
                        currentDetails.classList.add('panel-group');
                        if (field.group === '猎金与风险设置' || field.group === '全自动挂机') {
                            currentDetails.setAttribute('open', '');
                        }
                        const summary = document.createElement('summary');
                        summary.textContent = field.group;
                        currentDetails.appendChild(summary);
                        panel.appendChild(currentDetails);
                        
                        if (field.group === '配置选项') {
                            const waw = document.createElement('div');
                            waw.classList.add('panel-row', 'waw');
                            const warningAudioSelector = document.createElement('select');
                            warningAudioSelector.id = 'warningAudioSelector';
                            const warningAudioList = [{ id: 1, name: '不得不哈' }, { id: 2, name: '夜袭的小曲' }, { id: 3, name: '圆神' }];
                            warningAudioList.forEach((item) => {
                                const option = document.createElement('option'); option.textContent = item.name; option.value = item.id;
                                warningAudioSelector.appendChild(option);
                            })
                            const warningAudioSetButton = document.createElement('button');
                            warningAudioSetButton.textContent = '设置警告音频';
                            warningAudioSetButton.addEventListener('click', () => {
                                config.option.warning_audio = warningAudioSelector.value; cfg._save();
                                if (reloadInput.checked) location.reload();
                            })
                            warningAudioSelector.selectedIndex = warningAudioList.findIndex((__item) => __item.id === parseInt(config.option.warning_audio));
                            waw.appendChild(warningAudioSelector); waw.appendChild(warningAudioSetButton);
                            currentDetails.appendChild(waw);
                        }

                        currentGroup = field.group;
                    }

                    const row = document.createElement('div');
                    row.classList.add('panel-row');
                    if (field.cls !== '') field.cls.split(' ').forEach(cls => row.classList.add(cls));

                    const label = document.createElement('label');
                    label.classList.add('panel-label');
                    if (field.label && field.label.includes('<span')) label.innerHTML = field.label;
                    else label.textContent = field.label || field.key;
                    label.id = `${field.key}_label`;
                    
                    label.style.marginRight = '1rem'; 

                    if (field.desc) label.title = field.desc;

                    let curVal;
                    if (field.get) curVal = field.get();
                    else {
                        curVal = getByPath(cfg.state, field.path);
                        if (typeof curVal === 'undefined') curVal = getByPath(defaultsObj, field.path);
                    }

                    let input = document.createElement('input');
                    input.id = `${field.key}_id`;
                    label.setAttribute('for', input.id);

                    if (field.type === 'bool') {
                        input.type = 'checkbox'; input.checked = !!curVal;
                        input.addEventListener('change', () => {
                            if (field.set) field.set(input.checked);
                            else { setByPath(cfg.state, field.path, input.checked); cfg._save(); }
                            if (reloadInput.checked) location.reload();
                        });
                    } else if (field.type === 'number') {
                        input.type = 'number'; input.value = curVal ?? '0'; input.style.width = '90px';
                        input.addEventListener('blur', () => {
                            const v = parseInt(input.value, 10);
                            if (field.set) field.set(v); else { setByPath(cfg.state, field.path, v); cfg._save(); }
                            if (reloadInput.checked) location.reload();
                        });
                    } else {
                        input.type = 'text'; input.value = curVal ?? '';
                        input.addEventListener('change', () => {
                            const v = input.value;
                            if (field.set) field.set(v); else { setByPath(cfg.state, field.path, v); cfg._save(); }
                            if (reloadInput.checked) location.reload();
                        });
                    }

                    if (field.danger_mode && config.danger_mode.enabled === false) {
                        input.setAttribute('disabled', '');
                        row.classList.add('hidden');
                    }

                    row.appendChild(label);
                    row.appendChild(input);
                    currentDetails.appendChild(row);
                });

                utils.ui.separator.create(panel);
                const btn_group_func = document.createElement('div');
                btn_group_func.classList.add('btn-group');

                const set_hash = document.createElement('button');
                set_hash.textContent = '设置当前为跳转对象';
                set_hash.addEventListener('click', () => {
                    setByPath(cfg.state, 'redirect.current', location.hash);
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                });

                const print_drop_logs = document.createElement('button');
                print_drop_logs.textContent = '显示掉落日志';
                print_drop_logs.addEventListener('click', utils.cloud.read_battle_log)

                btn_group_func.appendChild(set_hash);
                btn_group_func.appendChild(print_drop_logs);

                const btn_group = document.createElement('div');
                btn_group.classList.add('btn-group');

                const btn_toggle_redirect = document.createElement('button');
                btn_toggle_redirect.textContent = '显示/隐藏重定向选项'
                btn_toggle_redirect.addEventListener('click', () => {
                    panel.querySelectorAll('.redirect').forEach(param => param.classList.toggle('hidden'));
                })
                btn_group.appendChild(btn_toggle_redirect);

                const bm_frame = document.createElement('div');
                bm_frame.classList.add('panel-row'); bm_frame.classList.add('redirect'); bm_frame.classList.add('bm-frame'); bm_frame.classList.add('hidden');
                const bookmark_add = document.createElement('div');
                bookmark_add.classList.add('bm-content');
                const bm_input = document.createElement('input');
                bm_input.type = 'text'; bm_input.value = `我的书签${config.bookmark.bookmarks.length}`; bm_input.id = 'bm_input'; bm_input.classList.add('bm-input');
                const bm_add = document.createElement('button');
                bm_add.textContent = '添加书签';
                bm_add.addEventListener('click', () => {
                    config.bookmark.bookmarks.push({ name: bm_input.value === '' ? `我的书签${config.bookmark.bookmarks.length}` : bm_input.value, hash: location.hash });
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                })
                bookmark_add.appendChild(bm_input); bookmark_add.appendChild(bm_add);
                const bookmark_del = document.createElement('div');
                bookmark_del.classList.add('bm-content');
                const bm_select = document.createElement('select'); bm_select.id = 'bm-select';
                bookmark_del.appendChild(bm_select); bm_frame.appendChild(bookmark_add);
                const bm_delete = document.createElement('button');
                bm_delete.textContent = '删除书签';
                bm_delete.addEventListener('click', () => {
                    config.bookmark.bookmarks = config.bookmark.bookmarks.filter(bookmark => bookmark.name !== bm_select.value);
                    const bookmark_body = document.querySelector('.bookmark');
                    if (bookmark_body) document.querySelector(`.bookmark-item[name="${bm_select.value}"]`).remove();
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                })
                bookmark_del.appendChild(bm_delete);
                if (config.bookmark.bookmarks.length === 0) bookmark_del.classList.add('hidden');
                bm_frame.appendChild(bookmark_del);

                if (config.bookmark.enabled === true) {
                    const bookmark_frame = document.createElement('div');
                    bookmark_frame.classList.add('bookmark');
                    config.bookmark.bookmarks.forEach((bookmark, index) => {
                        const item = document.createElement('div');
                        item.classList.add('bookmark-item'); item.setAttribute('name', bookmark.name);
                        item.textContent = `${(index + 1).toString().padStart(2, '0')} ${bookmark.name}`;
                        item.addEventListener('click', () => { utils.redirect.goto({ hash: bookmark.hash, force: true, immediately: true }) });
                        const option = document.createElement('option');
                        option.textContent = item.textContent; option.value = bookmark.name;
                        item.appendChild(document.createElement('span'));
                        bm_select.appendChild(option); bookmark_frame.appendChild(item);
                    })
                    document.body.appendChild(bookmark_frame);
                }

                const imex_frame = document.createElement('div');
                imex_frame.classList.add('bm-content');
                const import_file = document.createElement('input');
                import_file.type = 'file'; import_file.id = 'import_bm_file'; import_file.accept = '.json';
                const import_btn = document.createElement('button'); import_btn.textContent = '导入书签';
                const export_btn = document.createElement('button'); export_btn.textContent = '导出书签';
                imex_frame.appendChild(import_file); imex_frame.appendChild(import_btn);
                import_btn.addEventListener('click', () => {
                    if (import_file.files.length === 0) return;
                    const file = import_file.files[0]; const reader = new FileReader();
                    reader.onload = function (e) {
                        try { config.bookmark.bookmarks = JSON.parse(e.target.result); cfg._save(); if (reloadInput.checked) location.reload(); } 
                        catch (err) { console.error("JSON 解析失败:", err); }
                    };
                    reader.readAsText(file, "utf-8");
                })
                imex_frame.appendChild(export_btn);
                export_btn.addEventListener('click', () => { utils.tools.exportJSON(config.bookmark.bookmarks, 'sierokarte-bookmark.json'); })
                bm_frame.appendChild(imex_frame);

                document.body.classList.add('sierokarte');
                panel.appendChild(btn_group_func);
                utils.ui.separator.create(panel);
                panel.appendChild(btn_group);
                panel.appendChild(bm_frame);
                panel.addEventListener('click', (e) => e.stopPropagation());

                if (config.danger_mode.enable_layout_change && !navigator.userAgent.includes('iOS')) {
                    const footer = document.createElement('div');
                    footer.classList.add('siero-footer');
                    const wrapper = document.getElementById('wrapper');
                    const btns = [
                        { 'id': 'back', 'label': '返回', 'order': 1, 'action': () => utils.redirect.back() },
                        { 'id': 'reload', 'label': '刷新', 'order': 4, 'action': () => utils.redirect.reload(true) },
                        { 'id': 'home', 'label': '主页', 'order': 5, 'action': () => utils.redirect.goto({ hash: '#mypage', force: true, immediately: true }) },
                        { 'id': 'assist', 'label': '多人', 'order': 3, 'action': () => utils.redirect.goto({ hash: '#quest/assist', force: true, immediately: true }) },
                        { 'id': 'replicard', 'label': '转世', 'order': 2, 'action': () => utils.redirect.goto({ hash: '#replicard', force: true, immediately: true }) }
                    ]
                    btns.sort((a, b) => a.order - b.order);
                    btns.forEach(btn => {
                        const btn_item = document.createElement('div');
                        btn_item.classList.add('footer-btn-item'); btn_item.textContent = btn.label; btn_item.id = btn.id;
                        btn_item.addEventListener('click', btn.action); footer.appendChild(btn_item);
                    })
                    wrapper.appendChild(footer);
                }

                const panel_container = document.createElement('div');
                panel_container.classList.add('panel-container'); panel_container.classList.add('fade'); panel_container.classList.add('deactivated'); panel_container.classList.add('hidden');
                const panel_bg = document.createElement('div');
                panel_bg.classList.add('panel-background');
                panel_bg.addEventListener('click', () => { panel_container.classList.toggle('deactivated'); })
                panel_bg.appendChild(panel); panel_container.appendChild(panel_bg); document.body.appendChild(panel_container);
            }
        },
        random: () => {
            const ratio = config.danger_mode.enabled ? config.delay.ratio.hunt : config.delay.ratio.normal;
            let delay = 0;
            config.delay.factors.forEach((i) => {
                const min = i, max = i * ratio * 10;
                delay += Math.floor(Math.random() * (max - min + 1)) + min;
            })
            return Math.round(delay / config.delay.factors.length);
        },
        redirect: {
            back: () => { if (!is_script_paused) setTimeout(history.go.bind(history, -1), utils.random()); },
            reload: (force = false) => {
                if (is_script_paused) return;
                if (config.refresh.use_back) utils.redirect.back();
                else if (force) location.reload();
                else setTimeout(location.reload.bind(location), utils.random());
            },
            goto: ({hash = config.redirect.current, force = false, immediately = false} = {}) => {
                if (is_script_paused) return;
                const delay = immediately ? 0 : utils.random();
                setTimeout(() => {
                    if (force) {
                        if (hash && hash.startsWith('#')) location.hash = hash.slice(1);
                        else if (hash) window.open(`${location.origin}/${hash}`, '_self');
                        else location.reload();
                    } else location.href = hash || location.href;
                }, delay);
            },
            assist: () => utils.redirect.goto({hash: config.redirect.assist}),
            auto: () => { if (config.redirect.enabled && utils.urls.is_result() && config.redirect.current !== '') utils.redirect.goto({force: true}); },
        },
        safe_actions: {
            print: {
                async ensure_permission() { if (Notification.permission === 'default') await Notification.requestPermission(); },
                async drop(title, body, icon) { if (Notification.permission === 'granted') new Notification(title, { body: body, icon: icon }); }
            },
            play: {
                getAudioURL: (target) => `https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/warning_${String(target).padStart(2, '0')}.mp3`,
                warning: async () => {
                    const warning = new Audio(utils.safe_actions.play.getAudioURL(config.option.warning_audio));
                    warning.loop = true; await warning.play();
                }
            },
            watch: {
                async captcha(callback) {
                    let isTriggered = false;
                    const checkCaptcha = () => {
                        if (isTriggered || is_script_paused) return;
                        const popup = document.querySelector('#pop-c-a-i');
                        if (popup) {
                            if (popup.querySelector('input[placeholder*="認証文字"]') || popup.textContent.includes('画像認証')) {
                                isTriggered = true; callback();
                            }
                        }
                    };
                    new MutationObserver(checkCaptcha).observe(document.querySelector('#mobage-game-container') || document.body, { childList: true, subtree: true });
                    checkCaptcha();
                },
                async potion() {
                    setInterval(() => {
                        if (is_script_paused || !config.danger_mode.auto_potion) return;
                        const hpEl = document.querySelector('.lis-character0 .txt-hp-value');
                        const btnPotion = document.querySelector('#js-btn-potion');
                        if (hpEl && btnPotion && !btnPotion.classList.contains('disabled')) {
                            const hpText = hpEl.textContent.trim();
                            let percent = 100;
                            if (hpText.includes('%')) percent = parseInt(hpText.replace('%', ''), 10);
                            if (percent > 0 && percent <= 30) utils.tools.smartClick(btnPotion);
                        }
                    }, 2000);
                },
                async enemyHP(callback) {
                    const el = await utils.tools.waitForQ('.btn-enemy-gauge.prt-enemy-percent.alive > .txt-gauge-value');
                    if (!el) return;
                    let isTriggered = false;
                    const checkHP = () => {
                        if (isTriggered || is_script_paused) return;
                        const hp = Number((el.textContent ?? "").trim().replace('%', ''));
                        if (config.danger_mode.hp_refresh_at_10 && hp <= 5 && hp > 0) {
                            isTriggered = true; callback(); return;
                        }
                        if (hp === 0) { isTriggered = true; callback(); return; }
                    };
                    if (checkHP()) return () => {};
                    new MutationObserver(checkHP).observe(el, { childList: true, characterData: true, subtree: true });
                },
                async contribution(callback) {
                    const el = await utils.tools.waitForQ('.lis-user.player > .txt-point');
                    if (!el) return;
                    if (Number(el.textContent.trim().replace(/pt/g, '')) >= config.danger_mode.contribution) { callback(); return () => {}; }
                    new MutationObserver(() => {
                        if (is_script_paused) return;
                        if (Number(el.textContent.trim().replace(/pt/g, '')) >= config.danger_mode.contribution) callback();
                    }).observe(el, { childList: true, characterData: true, subtree: true });
                },
                async bossDown(callback) { await utils.safe_actions.watch.watchPop('.pop-usual.pop-rematch-fail.pop-show', callback) },
                async errorPop(callback) { await utils.safe_actions.watch.watchPop('.pop-usual.common-pop-error.pop-show', callback); },
                async watchPop(selector, callback) {
                    const root = await utils.tools.waitForQ('#mobage-game-container > div[id^="pop"]:not([id="pop-chat"])');
                    if (!root) return;
                    if (root.querySelector(selector)) { callback(root.querySelector(selector)); return () => {}; }
                    new MutationObserver(() => {
                        const el = root.querySelector(selector);
                        if (el) callback(el);
                    }).observe(root, { childList: true, subtree: true });
                },
            },
        },
        tools: {
            getEnhanceURL: () => location.origin + '/#enhancement/weapon/list_all/1/' + utils.tools.getFirstWeaponId() + '/' + new URL(location.href).hash.split('/')[3] + '/' + new URL(location.href).hash.split('/')[4] + '/1',
            getFirstWeaponId: () => document.querySelector('#lis-item > div:nth-child(1)').getAttribute('data-item-id'),
            sortBySummonCodeOrder(nodeListOrArray, orderStr, attr = 'summon-code') {
                const arr = Array.from(nodeListOrArray);
                const order = (orderStr === undefined ? '' : orderStr).split(',').map(s => s.trim()).filter(Boolean);
                const rank = new Map(order.map((code, i) => [code, i]));
                return arr.map((el, idx) => ({el, idx})).sort((a, b) => {
                    const ca = a.el.getAttribute(attr), cb = b.el.getAttribute(attr);
                    const ra = rank.has(ca) ? rank.get(ca) : Infinity, rb = rank.has(cb) ? rank.get(cb) : Infinity;
                    if (ra !== rb) return ra - rb;
                    return a.idx - b.idx;
                }).map(x => x.el);
            },
            exportJSON(obj, filename = "data.json") {
                const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
            },
            save_drop_log: async () => { return; },
            parseRewards(payload, groupBy = "key") {
                const acc = new Map();
                for (const [slot, v] of Object.entries(payload?.reward_list ?? {})) {
                    if (Array.isArray(v) || typeof v !== "object") continue;
                    for (const [k, item] of Object.entries(v)) {
                        const gid = groupBy === "id" ? item.id : k;
                        if (!acc.has(gid)) acc.set(gid, { key: k, id: item.id, name: item.name, rarity: item.rarity, item_kind: item.item_kind, count: 0, by_slot: {} });
                        const rec = acc.get(gid); const c = Number(item.count ?? 1) || 0;
                        rec.count += c; rec.by_slot[slot] = (rec.by_slot[slot] ?? 0) + c;
                    }
                }
                return Array.from(acc.values());
            },
            drop_notify: async (battle_date, data) => {
                const {drop} = utils.safe_actions.print;
                const result = utils.tools.parseRewards(data.result_data?.rewards);
                await utils.tools.save_drop_log(battle_date, data);
                let title = '[工坊]获得蓝箱道具', body = '', icon = icon_url.mine;
                result.forEach(r => {
                    if (r.by_slot.hasOwnProperty(11)) {
                        if (r.name !== 'ヒヒイロカネ') body += `[蓝箱] ${r.name} x ${r.count}\n`;
                        else { icon = icon_url.gold_brick; title = title.replace('蓝箱道具', '绯绯金'); body += `[蓝箱] 获得了绯绯金！${r.name} x ${r.count}`; }
                    }
                })
                if (body !== '') await drop(title, body, icon);
            },
            ensureBtnObserver(runOnce) {
                const mo = new MutationObserver(() => {
                    if (is_script_paused) return;
                    const b = document.querySelector('.btn-usual-ok.se-quest-start');
                    if (b && utils.tools.isVisibleNow(b)) runOnce(b);
                });
                mo.observe(document.body, {childList: true, subtree: true});
                setTimeout(() => mo.disconnect(), 30000);
            },
            tryParseJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } },
            isVisibleNow(el) {
                if (!el) return false;
                const st = getComputedStyle(el);
                return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
            },
            register_scroller() { new MouseScroller(document.querySelector('.SdEyhW_kE0xoDznTZ5Wr-'), { direction: 'y', damping: 0.95, minVelocity: 0.5 }); },
            async smartClick(el, idx = 1) {
                if (is_script_paused) return;
                setTimeout(() => { $(el).trigger($.Event('tap')); }, 250 * idx);
            },
            waitForQ(selector, pred = (el) => !!el, {interval = 10, timeout = 5000} = {}) {
                return new Promise((resolve, reject) => {
                    const t0 = Date.now();
                    const tick = () => {
                        if (is_script_paused) return reject(new Error('paused'));
                        const el = document.querySelector(selector);
                        if (el && pred(el)) return resolve(el);
                        if (Date.now() - t0 >= timeout) return reject(new Error('timeout'));
                        setTimeout(tick, interval);
                    };
                    tick();
                });
            },
        },
        ui: {
            separator: { create(parent) { const sep = document.createElement('div'); sep.classList.add('separator'); parent.appendChild(sep); } },
            unload_panel: () => {
                const panel = document.querySelector('div.config-panel');
                const toggle = document.querySelectorAll('div.floating');
                if (panel) panel.remove();
                toggle.forEach(t => t.remove());
            }
        },
        urls: {
            get_xhr_type: (url) => url.pathname.split('/').pop() || '',
            is_battle_type: (url) => utils.urls.is_json(url) && defaults.set.includes(utils.urls.get_xhr_type(url)),
            is_home: () => location.href.includes('#mypage'),
            is_json: (url) => url.pathname.endsWith('.json'),
            is_list_request: (url) => url.href.includes('rest/quest/assist/search/assist_list'),
            is_multi_raid: (url = new URL(location.href)) => url.href.includes('/#raid_multi/'),
            is_quest: () => location.href.includes('#quest/assist'), 
            is_raid: (url = new URL(location.href)) => url.href.includes('#raid/') && !url.href.includes('#raid_multi/'),
            is_recycle: (url = new URL(location.href)) => url.href.includes('#recycle'),
            is_decompose: (url = new URL(location.href)) => url.href.includes('#decompose'),
            is_result: (url = new URL(location.href)) => url.href.includes('#result'),
            is_balancing: (url = new URL(location.href)) => url.href.includes('/resultmulti/content/index'),
            is_scene: () => location.href.includes('scene'),
            is_spsl: () => location.href.includes('supporter'),
            is_bonus_stock: () => location.href.includes('#bonus_stock'),
            is_present: () => location.href.includes('#present'),
            has_uid: (url) => { if (url.href.includes('uid=')) uid = url.searchParams.get('uid'); },
            is_weapon_detail: () => location.href.includes('#container/detail/weapon'),
            is_weapon_list: () => location.href.includes('#container/list/weapon'),
            is_enhance: () => location.href.includes('#enhancement/weapon/list_all'),
            is_material_select: () => location.href.includes('#enhancement/weapon/material'),
        }
    }
    // endregion

    class MouseScroller {
        constructor(container, options = {}) {
            this.container = container;
            this.options = { direction: options.direction || 'both', damping: options.damping ?? 0.95, minVelocity: options.minVelocity ?? 0.5, maxVelocity: options.maxVelocity ?? 100 };
            this.isDragging = false; this.rafId = null;
            this._onMouseDown = this._onMouseDown.bind(this); this._onMouseMove = this._onMouseMove.bind(this);
            this._onMouseUp = this._onMouseUp.bind(this); this._inertiaLoop = this._inertiaLoop.bind(this);
            this._addEvents();
        }
        _addEvents() { this.container.addEventListener('mousedown', this._onMouseDown); document.addEventListener('mouseup', this._onMouseUp); document.addEventListener('mousemove', this._onMouseMove); }
        _onMouseDown(e) {
            this.isDragging = true; this.startX = e.clientX; this.startY = e.clientY;
            this.scrollLeft = this.container.scrollLeft; this.scrollTop = this.container.scrollTop;
            this.velocityX = 0; this.velocityY = 0; cancelAnimationFrame(this.rafId); this.container.style.cursor = 'grabbing';
        }
        _onMouseMove(e) {
            if (!this.isDragging) return;
            const dx = e.clientX - this.startX, dy = e.clientY - this.startY;
            if (this.options.direction !== 'y') { this.container.scrollLeft = this.scrollLeft - dx; this._lastMoveX = this.container.scrollLeft; }
            if (this.options.direction !== 'x') { this.container.scrollTop = this.scrollTop - dy; this._lastMoveY = this.container.scrollTop; }
            this._lastMoveTime = Date.now();
        }
        _onMouseUp() {
            if (!this.isDragging) return;
            this.isDragging = false; this.container.style.cursor = 'default';
            const dt = Date.now() - this._lastMoveTime || 16;
            if (this.options.direction !== 'y') { this.velocityX = Math.max(Math.min((this.container.scrollLeft - this._lastMoveX) / dt * 16, this.options.maxVelocity), -this.options.maxVelocity); }
            if (this.options.direction !== 'x') { this.velocityY = Math.max(Math.min((this.container.scrollTop - this._lastMoveY) / dt * 16, this.options.maxVelocity), -this.options.maxVelocity); }
            this.rafId = requestAnimationFrame(this._inertiaLoop);
        }
        _inertiaLoop() {
            if (Math.abs(this.velocityX) > this.options.minVelocity || Math.abs(this.velocityY) > this.options.minVelocity) {
                if (this.options.direction !== 'y') { this.container.scrollLeft += this.velocityX; this.velocityX *= this.options.damping; }
                if (this.options.direction !== 'x') { this.container.scrollTop += this.velocityY; this.velocityY *= this.options.damping; }
                this.rafId = requestAnimationFrame(this._inertiaLoop);
            }
        }
        disable() { this.isDragging = false; this.velocityX = 0; this.velocityY = 0; cancelAnimationFrame(this.rafId); }
    }

    const _st = window.setTimeout, _ct = window.clearTimeout, _si = window.setInterval, _ci = window.clearInterval, _raf = window.requestAnimationFrame, _caf = window.cancelAnimationFrame;
    const timeouts = new Set(), intervals = new Set(), rafs = new Set();

    window.setTimeout = (fn, t, ...a) => { const id = _st(() => { timeouts.delete(id); fn(); }, t, ...a); timeouts.add(id); return id; };
    window.clearTimeout = (id) => { timeouts.delete(id); _ct(id); };
    window.setInterval = (fn, t, ...a) => { const id = _si(fn, t, ...a); intervals.add(id); return id; };
    window.clearInterval = (id) => { intervals.delete(id); _ci(id); };
    window.requestAnimationFrame = (fn) => { const id = _raf((ts) => { rafs.delete(id); fn(ts); }); rafs.add(id); return id; };
    window.cancelAnimationFrame = (id) => { rafs.delete(id); _caf(id); };

    const clearAllTimers = () => {
        document.querySelectorAll('body > script').forEach(i => i.remove());
        document.querySelectorAll('body > iframe').forEach(i => i.remove());
        timeouts.forEach(_ct); timeouts.clear();
        intervals.forEach(_ci); intervals.clear();
        rafs.forEach(_caf); rafs.clear();
    };

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
            config.option.force_pause = !config.option.force_pause;
            C._save();
            is_script_paused = config.option.force_pause;
            const pauseInput = document.getElementById('force_pause_id');
            if (pauseInput) pauseInput.checked = is_script_paused;
            
            if (is_script_paused) {
                clearAllTimers();
                if (!pause_toast) {
                    pause_toast = document.createElement('div');
                    pause_toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(220, 38, 38, 0.95); color:white; padding:12px 24px; border-radius:8px; z-index:999999; font-size:18px; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none;";
                    pause_toast.textContent = "⚠️ 脚本已暂停运行 (Ctrl+Shift+X 恢复)";
                    document.body.appendChild(pause_toast);
                }
                pause_toast.style.display = 'block';
            } else {
                if (pause_toast) pause_toast.style.display = 'none';
                utils.inject();
            }
        }
    });

    (() => {
        const fire = () => window.dispatchEvent(new Event('locationchange'));
        const {pushState, replaceState} = history;
        history.pushState = function (...args) { pushState.apply(this, args); fire(); };
        history.replaceState = function (...args) { replaceState.apply(this, args); fire(); };
        window.addEventListener('popstate', fire); window.addEventListener('hashchange', fire);
    })();

    const XHR = XMLHttpRequest, _open = XHR.prototype.open, _send = XHR.prototype.send;
    XHR.prototype.open = function (method, url, ...rest) { return _open.call(this, method, url, ...rest); };
    XHR.prototype.send = function (...args) {
        this.addEventListener('readystatechange', () => {
            if (this.readyState !== 4) return;
            try {
                if (this.status !== 200 || this.response === 'null') return;
                const targetUrl = new URL(this.responseURL);
                last_xhr_time = Date.now();
                if (uid === 0) utils.urls.has_uid(targetUrl);
                if (!(targetUrl.hostname.endsWith('granbluefantasy.jp') && !targetUrl.hostname.includes('ws.') && !targetUrl.pathname.includes('ob') && !targetUrl.pathname.includes('socket') && !targetUrl.hostname.includes('sound'))) return;

                const raw = this.responseType === 'json' ? this.response : utils.tools.tryParseJSON(this.responseText);
                if (utils.urls.is_battle_type(targetUrl)) {
                    window.dispatchEvent(new CustomEvent('sierokarte-xhr', { detail: {key: utils.urls.get_xhr_type(targetUrl), scenario: raw.scenario ?? raw} }));
                    return;
                }

                if (config.option.enable_drop_notify && utils.urls.is_balancing(targetUrl)) {
                    const data = JSON.parse(this.response)?.option;
                    if (data) utils.tools.drop_notify(new Date().toISOString(), data).then(() => {});
                    return;
                }

                const adjusted = { replaced: raw, asString: this.responseText };
                if (config.danger_mode.filtering && utils.urls.is_list_request(targetUrl)) {
                    adjusted.replaced = { assist_raids_data: utils.handle_list(raw.assist_raids_data) };
                    adjusted.asString = JSON.stringify(adjusted.replaced);
                }
                try { Object.defineProperty(this, 'responseText', { get: () => adjusted.asString }); } catch {}
                try { Object.defineProperty(this, 'response', { get: () => this.responseType === 'json' ? adjusted.replaced : adjusted.asString }); } catch {}
            } catch (e) { console.error('patch error:', e); }
        }, {once: false});
        return _send.apply(this, args);
    };

    window.addEventListener('locationchange', utils.onLoad);
    window.addEventListener('DOMContentLoaded', utils.onLoad);
    window.addEventListener('popstate', utils.onLoad);
    window.addEventListener('hashchange', utils.onLoad);
    document.addEventListener('readystatechange', () => { if (document.readyState === 'complete') utils.redirect.auto(); });
    window.addEventListener('sierokarte-xhr', (e) => { const {key, scenario} = e.detail; utils.handle(scenario, key); });
})();
// endregion