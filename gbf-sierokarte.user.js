// ==UserScript==
// @name                榭洛科特工坊
// @version             0.3.71
// @author              Alk
// @license             GPL-3.0
// @description         榭洛科特工坊 -
// @match               https://*.granbluefantasy.jp/*
// @match               https://gbf.game.mbga.jp/*
// @resource            sierokarte https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf_custom.css
// @grant               GM_getResourceText
// @grant               GM_addStyle
// @run-at              document-start
// @namespace           https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @icon                https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/sierokarte.png
// @downloadURL         https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @updateURL           https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/gbf-sierokarte.user.js
// @supportURL          https://www.neko-tail.wang/
// @homepageURL         https://www.neko-tail.wang/
// ==/UserScript==

// region FULL CODE
(function () {
    'use strict';

    const version = '0.3.71';

    // region 配置默认值
    const defaults = {
        refresh: {
            use_back: false,
            attack: true,
            keywords: [
                {
                    id: 'koenig_dekret',
                    enabled: false,
                    keys: ['ケーニヒ・ベシュテレン']
                },
                {
                    id: 'coronal_ejection',
                    enabled: false,
                    keys: ['火属性ダメージ/3番目までに配置された火属性キャラがターン進行時に攻撃行動を２回行う']
                },
                {
                    id: 'secret_triad',
                    enabled: false,
                    keys: ['シークレットトライアド']
                },
                {
                    id: 'yatima',
                    enabled: false,
                    keys: ['ヤチマ']
                },
                {
                    id: 'two_platoons',
                    enabled: false,
                    keys: ['ツープラトン']
                },
                {
                    id: 'war_eternal',
                    enabled: false,
                    keys: ['ウォー・エターナル＋']
                },
                {
                    id: 'hundred_year_lapis_brilliance',
                    enabled: false,
                    keys: ['百年瑠璃光＋']
                },
                {
                    id: 'transcendent_blue',
                    enabled: false,
                    keys: ['アセンダンス・ブルー']
                }
            ]
        },
        danger_mode: {
            enabled: false,
            filtering: false,
            filtering_by_asc: true,
            enable_layout_change: false,
            auto_enter: false,
            auto_raid_select: false,
            auto_auto: false,
            auto_skip_scene: false,
            auto_summon: false,
            auto_summon_prefer: '',
            hp_less_than: 50,
            member_more_than: 5,
            contribution: 1800000,
            sub_options: [
                'filtering', 'filtering_by_asc', 'auto_auto'
            ]
        },
        redirect: {
            enabled: false,
            assist: '#quest/assist',
            current: '',
        },
        delay: {
            factors: [125, 125, 125],
            ratio: {
                normal: 3,
                hunt: 1
            }
        },
        set: [
            'normal_attack_result.json',
            'ability_result.json',
            'fatal_chain_result.json',
            'summon_result.json'
        ],
        bookmark: {
            enabled: false,
            bookmarks: []
        },
        option: {
            enable_touch_mode: false,
            enable_scroller: true,
            enable_drop_notify: true,
            enable_hide_left_sidebar: true,
            enable_hide_right_sidebar: true,
            warning_audio: 3,
        },
    };
    // endregion

    // region 配置
    class Config {
        constructor(key, defaults) {
            this.key = key;
            this.defaults = defaults;
            this.state = {...defaults, ...this._read()};
        }

        _read() {
            try {
                return JSON.parse(localStorage.getItem(this.key) || '{}');
            } catch {
                return {};
            }
        }

        _save() {
            localStorage.setItem(this.key, JSON.stringify(this.state));
        }

        get(k) {
            return k in this.state ? this.state[k] : this.defaults[k];
        }

        set(k, v) {
            this.state[k] = v;
            this._save();
        }

        toggle(k) {
            this.set(k, !this.get(k));
        }
    }

    const C = new Config('sierokarte', defaults);
    const config = C.state;
    // endregion

    // region 固定链接

    const icon_url = {
        mine: 'https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/sierokarte.png',
        gold_brick: 'https://gbf.wiki/images/5/5b/Gold_Brick_square.jpg',
    };
    // endregion

    // region uid
    let uid = 0;
    // endregion

    // region 应用风格
    const isTamperMonkeyEnvironment = typeof GM_getResourceText !== 'undefined';
    if (isTamperMonkeyEnvironment) {
        const css = GM_getResourceText('sierokarte');
        GM_addStyle(css);
    }
    // endregion

    // region 主要函数
    const utils = {
        cloud: {
            write_battle_log: async (battle_log) => {
                await fetch('https://battlenote.neko-tail.wang/save_log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(battle_log)
                })
            },
            read_battle_log: async () => {
                const res = await fetch(`https://battlenote.neko-tail.wang/${uid}`);
                return await res.json();
            }
        },
        danger_actions: {
            async enter_raid() {
                console.debug(`尝试自动进入副本...`);

                const PRI = '.btn-usual-ok.se-quest-start';
                const SEC = '.btn-usual-ok.btn-silent-se';
                const opts = {interval: 550, timeout: 550}; // 10 次

                let sel = null;

                // region 每次 tick 重新拿按钮，并以“尺寸可见”为准
                // 优先：se-quest-start
                try {
                    sel = await utils.tools.waitForQ(PRI, utils.tools.isVisibleNow, opts);
                } catch {
                    // 回退：btn-silent-se
                    try {
                        sel = await utils.tools.waitForQ(SEC, utils.tools.isVisibleNow, opts);
                    } catch {
                        console.debug('两种按钮都未出现，稍后重试');
                        setTimeout(utils.danger_actions.enter_raid, 500);
                        return;
                    }
                }

                try {
                    // 点击 10 轮或按钮消失
                    let n = 0;
                    while (n < 50) {
                        console.debug(`尝试中...第${n}次`);
                        await utils.tools.smartClick(sel);
                        n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        // 按钮消失或进入页面变化则停止
                        if (!document.body.contains(sel) || !utils.tools.isVisibleNow(sel)) {
                            console.debug('页面不再存在该元素...结束...')
                            break;
                        } else if (document.querySelector('#pop-c-a-i')?.children.length > 0) {
                            await utils.safe_actions.play.warning();
                            break;
                        }
                    }
                    if (n >= 50) console.debug('OK按钮点击重试达到50次上限');
                } catch (e) {
                    console.debug('自动进入副本等待失败：', e?.message);
                    // 兜底：监听插入后立即点击一次
                    utils.tools.ensureBtnObserver(async (b) => {
                        await utils.tools.smartClick(b);
                    });
                    setTimeout(utils.danger_actions.enter_raid, 500);
                }
                // endregion
            },
            async skip_scene() {
                console.debug('尝试自动跳过剧情...');
                if (!utils.urls.is_scene()) return;

                try {
                    // 每次 tick 重新拿按钮，并以“尺寸可见”为准
                    const btn = await utils.tools.waitForQ('.btn-skip', utils.tools.isVisibleNow, {
                        interval: 550,
                        timeout: 550
                    });
                    console.debug('查找跳过按钮：', btn);

                    // 点击 10 轮或按钮消失
                    let n = 0;
                    while (n < 20) {
                        const target = document.querySelector('.btn-skip');
                        if (!target) break;
                        await utils.tools.smartClick(target);
                        n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        // 按钮消失或进入页面变化则停止
                        const skip_btn = document.querySelector('.btn-scene-skip');
                        if (document.body.contains(skip_btn) || utils.tools.isVisibleNow(skip_btn)) break;
                    }
                    if (n >= 20) console.debug('跳过按钮点击重试达到上限');

                    n = 0; // 重置计数器来尝试按下确认跳过
                    while (n < 20) {
                        const confirm = document.querySelector('.btn-scene-skip');
                        if (!confirm) break;
                        await utils.tools.smartClick(confirm);
                        n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        // 按钮消失或进入页面变化则停止
                        if (!document.body.contains(confirm) || !utils.tools.isVisibleNow(confirm)) break;
                    }
                    if (n >= 20) console.debug('确认跳过按钮点击重试达到20次上限');
                } catch (e) {
                    console.debug('自动跳过剧情等待失败', e?.message);
                    // 兜底：监听插入后立即点击一次
                    utils.tools.ensureBtnObserver(async (b) => {
                        await utils.tools.smartClick(b);
                    });
                    setTimeout(utils.danger_actions.skip_scene, 500);
                }
            },
            async tap_auto() {
                console.debug('尝试启用自动战斗...');
                const is_raid = utils.urls.is_raid();
                const is_multi = utils.urls.is_multi_raid();
                if (!(is_raid || is_multi)) return;
                try {
                    // 每次 tick 重新拿按钮，并以“尺寸可见”为准
                    const btn = await utils.tools.waitForQ('.prt-start-direction', utils.tools.isVisibleNow, {
                        interval: 550,
                        timeout: 550
                    });
                    console.debug('查找自动按钮：', btn);

                    // 点击 10 轮或按钮消失
                    let n = 0;
                    while (n < 25) {
                        console.debug('检测是否存在黑屏框架...');
                        const start_dir = document.querySelector('.prt-start-direction');
                        if (!start_dir || start_dir?.style?.display === 'none') {
                            console.debug('未找到黑屏框架...重试...');
                            break;
                        }

                        console.debug('检测是否存在黑屏元素...');
                        const black_bg = document.querySelector('.prt-black-bg');
                        if (!black_bg) {
                            console.debug('未找到黑屏元素...重试...');
                            break;
                        }

                        console.debug('尝试点击黑屏...');
                        await utils.tools.smartClick(black_bg);
                        n++;
                        await new Promise(r => setTimeout(r, 250 + utils.random()));
                        // 确认是否已经存在自动提示
                        const btn_ready_auto = document.querySelector('.btn-ready-auto.anim-simple-fadein');
                        console.debug('检测是否存在启用自动元素...');
                        if (document.body.contains(btn_ready_auto) || utils.tools.isVisibleNow(btn_ready_auto)) {
                            console.debug('存在启用自动元素...结束');
                            break;
                        }
                    }
                    if (n >= 25) console.debug('自动按钮点击重试达到25次上限');
                } catch (e) {
                    console.debug(`自动战斗启动失败...${e}`);
                    // 兜底：监听插入后立即点击一次
                    utils.tools.ensureBtnObserver(async (b) => {
                        await utils.tools.smartClick(b);
                    });
                    setTimeout(utils.danger_actions.tap_auto, 500);
                }
            },
            async select_item(selector) {
                const w = document.querySelectorAll(selector);
                w.forEach((i, idx) => {
                    utils.tools.smartClick(i, idx);
                });
            },
            async tap_summon() {
                console.debug('尝试自动投放召唤');
                const url_state = {
                    is_raid: utils.urls.is_raid(),
                    is_multi: utils.urls.is_multi_raid(),
                }
                if (url_state.is_raid === false && url_state.is_multi === false) {
                    console.debug('非副本，跳过...',)
                    return;
                }

                try {
                    // 每次 tick 重新拿按钮，并以“尺寸可见”为准
                    const btn = await utils.tools.waitForQ('#js-btn-quick-summon', utils.tools.isVisibleNow, {
                        interval: 550,
                        timeout: 550
                    });
                    console.debug('查找召唤按钮：', btn);

                    if (!btn.classList.contains('qs-recast') || btn.classList.contains('qs-disable')) return;

                    // 点击 10 轮或按钮消失
                    const try_click = async function () {
                        let n = 0;
                        while (n < 5) {
                            // 召唤列表按钮
                            const summon_list_btn = document.querySelector('.btn-command-summon');

                            // 当前可用召唤按钮
                            const raw = document.querySelector('.prt-summon-list').querySelectorAll('.btn-summon-available');
                            const targets = utils.tools.sortBySummonCodeOrder(raw, config.danger_mode.auto_summon_prefer);
                            if (!targets || targets.length === 0) return;

                            let target = targets[0];
                            // console.debug(target, targets.length, (target.getAttribute('summon-code') === '2040425000'));
                            // 当前召唤石为000？
                            if (target.getAttribute('summon-code') === '2040425000') {
                                // 取得主角buff
                                const djeeta = document.querySelector('.lis-character0.btn-command-character');
                                // 是否可以使用000
                                const feather_enough = djeeta.querySelector('[data-status="7743_12"]') !== null;
                                const triple_zero_black_wing = target.getAttribute('summon-require') === '9';
                                const is_available_for_000 = triple_zero_black_wing || feather_enough;
                                if (is_available_for_000 === false && targets.length === 1) {
                                    target = null;
                                    console.debug('set target to none.')
                                } else if (is_available_for_000 === false && targets.length > 1) {
                                    target = targets[1];
                                    console.debug('set target to nextElementSibling.', target)
                                }
                            }

                            if (target === null) return;

                            await utils.tools.smartClick(summon_list_btn);
                            await new Promise(resolve => setTimeout(resolve, 250 + utils.random()));
                            await utils.tools.smartClick(target);
                            await new Promise(r => setTimeout(r, 250 + utils.random()));
                            const skip_btn = await utils.tools.waitForQ('.btn-usual-ok.btn-summon-use', utils.tools.isVisibleNow);

                            n++;

                            if (skip_btn) {
                                await utils.tools.smartClick(skip_btn);
                                break;
                            }
                        }
                        if (n >= 5) console.debug('跳过按钮点击重试达到上限');
                    }

                    await try_click();
                } catch (e) {
                    console.debug('自动投放召唤', e?.message);
                    // 兜底：监听插入后立即点击一次
                    utils.tools.ensureBtnObserver(async (b) => {
                        await utils.tools.smartClick(b);
                    });
                    setTimeout(utils.danger_actions.tap_summon, 500);
                }
            },
            async select_raid() {
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

                const getRaidList = () =>
                    document.querySelectorAll(
                        `.btn-multi-raid.lis-raid.search[data-quest-id]`
                    );

                const check_raid = async () => {
                    const raid_list = getRaidList();
                    if (raid_list.length === 0) {
                        const refresh_btn = document.querySelector(".btn-search-refresh");
                        if (refresh_btn) await utils.tools.smartClick(refresh_btn);

                        await sleep(350 + utils.random());
                        return check_raid();
                    } else {
                        await utils.tools.smartClick(raid_list[0]);
                    }
                };

                await check_raid();
            },
        },
        elements: {
            body: null,
            contribution: null,
        },
        handle: (scenario, urlKey) => {
            if (typeof scenario.find !== 'function') {
                // console.debug('handler stopped! scenario type is: ' + typeof scenario.find);
                return;
            }
            const winObj = scenario.find(o => o['cmd'] === 'win');
            const winStatus = winObj
                ? (winObj['is_last_raid'] === 1 ? 'raid' : 'battle')
                : 'continue';
            // console.debug('胜利状态判定为: ' + winStatus);

            if (winStatus === 'raid') {
                // console.debug('副本胜利，尝试刷新来结束结算...');
                utils.redirect.reload();
            }
            if (winStatus === 'battle') {
                // console.debug('阶段性胜利，尝试跳转到阶段页面...');
                utils.redirect.goto({
                    hash: '#quest/stage'
                });
            }

            const is_normal_attack = urlKey === config.set[0];
            const is_ability = urlKey === config.set[1];
            const is_summon = urlKey === config.set[3];
            const is_ability_or_summon = is_ability || is_summon;
            // console.debug('检测是否为普通攻击...');

            // 启用了自动召唤
            if (config.danger_mode.auto_summon === true && is_summon === true) {
                utils.redirect.reload();
            }

            // 当前为普通攻击 且 允许普通攻击后刷新
            if (is_normal_attack && config.refresh.attack === true) {
                utils.redirect.reload();
            }
            // console.debug(`当前操作${is_normal_attack ? '为' : '非'}普通攻击`);

            // 检测当前技能释放是否存在于刷新列表
            if (is_ability_or_summon) {
                const ability = scenario.find(o => o['cmd'] === 'ability');
                if (ability) {
                    const name = ability.name;
                    console.debug(`当前使用的技能名为：${name}，开始比对...`)
                    config.refresh.keywords.some((item) => {
                        console.debug(`当前比较对象为${item.id}, ${item.enabled}, ${item.keys.join(', ')}`)
                        if (item.enabled) {
                            console.debug(`当前比较结果为${item.keys.includes(name)}`);
                            if (item.keys.includes(name)) {
                                utils.redirect.reload();
                            }
                        }
                    })
                }
            }
        },
        handle_list: (arr) => {
            return arr
                .map(r => {
                    const hp = Number(r.boss_hp_width), mc = Number(r.member_count);
                    const key = hp >= 80 ? [0, mc, -hp] : [1, -hp, mc]; // 先分组，再构造排序键
                    return {r, key};
                })
                .filter(x => x.r.boss_hp_width >= config.danger_mode.hp_less_than && x.r.member_count <= config.danger_mode.member_more_than)
                .sort((x, y) => {
                    for (let i = 0; i < x.key.length; i++) {
                        const d = x.key[i] - y.key[i];
                        if (d !== 0) return d;
                    }
                    return 0;
                })
                .map(x => x.r);
        },
        info: {
            auto_click_start_try_dt: null,
            contribution: 0,
            turn: 0,
            auto_enabled: false,
            member: 0,
            boss_gauge: 0,
            one_click_enhance: {
                bookmark: '',
            }
        },
        inject: () => {
            // region 短化引用
            const {urls, elements} = utils;
            // endregion

            // region 查找已存在的开关和面板，如果有，注销
            utils.ui.unload_panel();
            // endregion

            // region 设置CSS
            elements.body = document.querySelector('body');
            elements.body?.classList?.add('sierokarte');
            if (config.danger_mode.enable_layout_change) {
                elements.body.classList.add('styled');
                if (urls.is_home()) {
                    elements.body.classList.add('home');
                }
            }

            if (config.option.enable_hide_left_sidebar) {
                elements.body.classList.add('no-left-sidebar');
            }
            if (config.option.enable_hide_right_sidebar) {
                elements.body.classList.add('no-right-sidebar');
            }

            if (config.option.enable_touch_mode) {
                elements.body.classList.add('touch');
            }
            // endregion

            // region 创建面板 删除已存在的面板
            const panel = document.querySelector('.panel-container');
            if (panel) {
                panel.remove();
            }
            const bookmark = document.querySelector('.bookmark');
            if (bookmark) {
                bookmark.remove();
            }
            const footer = document.querySelector('.siero-footer');
            if (footer) {
                footer.remove();
            }
            utils.panel.create(C, defaults);
            // endregion

            // region 禁用所有图片的抓取
            setTimeout(() => {
                const images = document.querySelectorAll('img');
                images.forEach(image => {
                    image.draggable = false;
                })
            }, 1000)
            // endregion

            // region 当前页面为任意副本时
            if (urls.is_raid() || urls.is_multi_raid()) {
                // console.debug('检测到副本，尝试执行副本插件...')
                if (config.danger_mode.auto_auto) {
                    setTimeout(utils.danger_actions.tap_auto, 300);
                }

                if (config.danger_mode.auto_summon) {
                    setTimeout(utils.danger_actions.tap_summon, 300);
                }

                utils.safe_actions.watch.enemyHP(utils.redirect.reload);
                utils.safe_actions.watch.bossDown(utils.redirect.reload).then(r => {});
                utils.safe_actions.watch.errorPop(utils.redirect.reload).then(r => {});

                if (config.danger_mode.auto_raid_select === true) {
                    utils.safe_actions.watch.contribution(utils.redirect.assist);
                }
            }
            // endregion

            // region 当前页面为友召选择或副本选择
            if (urls.is_spsl()) {
                if (config.danger_mode.auto_enter === true) {
                    console.debug('检测到副本，尝试执行自动进入副本插件...')
                    utils.danger_actions.enter_raid().then(() => {
                    });
                }
            }
            // endregion

            // region 当前页面为剧情
            if (urls.is_scene()) {
                if (config.danger_mode.auto_skip_scene === true) {
                    utils.danger_actions.skip_scene().then(() => {
                    });
                }
            }
            // endregion

            // region 当前页面为多人副本选择
            if (urls.is_quest()) {
                if (config.danger_mode.auto_raid_select === true) {
                    utils.danger_actions.select_raid().then(() => {
                    });
                }
            }
            // endregion
        },
        onLoad: () => {
            clearAllTimers();
            utils.inject();
            if (!utils.urls.is_home()) {
                document.body?.classList?.remove('home');
                document.body?.classList?.remove('clean');
            }
            utils.redirect.auto();
            if (config.option.enable_scroller) {
                utils.tools.register_scroller();
            }
        },
        panel: {
            create: (cfg /* Config 实例 */, defaultsObj /* 嵌套 defaults */) => {
                // region 工具：深路径读取/写入（支持 a.b[0].c）
                const getByPath = (obj, path) => {
                    return path.replace(/\[(\d+)]/g, '.$1').split('.')
                        .reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
                };
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
                // endregion

                // region 三个技能开关在数组 refresh.keywords 按 id 匹配
                const getKeywordEnabled = (id) => {
                    const arr = cfg.state.refresh?.keywords || [];
                    const item = arr.find(it => it.id === id);
                    return !!(item && item.enabled);
                };
                const setKeywordEnabled = (id, enabled) => {
                    const arr = cfg.state.refresh?.keywords || [];
                    const idx = arr.findIndex(it => it.id === id);
                    if (idx >= 0) {
                        arr[idx].enabled = !!enabled;
                    } else {
                        // 兜底：若缺项则补齐结构
                        (cfg.state.refresh || (cfg.state.refresh = {}));
                        (cfg.state.refresh.keywords || (cfg.state.refresh.keywords = []));
                        cfg.state.refresh.keywords.push({id, enabled: !!enabled, keys: []});
                    }
                    cfg._save();
                };
                // endregion

                // region UI 字段到嵌套路径/自定义 getter/setter的映射
                const FIELDS = [
                    {
                        key: 'refresh_attack',
                        label: '♼普通攻击',
                        desc: '允许在普通攻击发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        type: 'bool',
                        path: 'refresh.attack',
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_koenig_dekret',
                        label: '♼帝王法令',
                        desc: '允许在帝王法令*（限定炎帝3技能）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        type: 'bool',
                        get: () => getKeywordEnabled('koenig_dekret'),
                        set: (v) => setKeywordEnabled('koenig_dekret', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_coronal_ejection',
                        label: '♼日冕喷发',
                        desc: '允许在日冕喷发*（太阳召唤石）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        type: 'bool',
                        get: () => getKeywordEnabled('coronal_ejection'),
                        set: (v) => setKeywordEnabled('coronal_ejection', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_secret_triad',
                        label: '♼万事皆三',
                        type: 'bool',
                        desc: '允许在万事皆三（魔导三环）发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('secret_triad'),
                        set: (v) => setKeywordEnabled('secret_triad', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_yatima',
                        label: '♼雅琪玛',
                        type: 'bool',
                        desc: '允许在【雅琪玛】【召唤】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('yatima'),
                        set: (v) => setKeywordEnabled('yatima', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_two_platoons',
                        label: '♼双打',
                        type: 'bool',
                        desc: '允许在双打【相扑】【技能】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('two_platoons'),
                        set: (v) => setKeywordEnabled('two_platoons', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_war_eternal',
                        label: '♼无尽战争',
                        type: 'bool',
                        desc: '允许在无尽战争【伊尔莎】/【教官】【暗】【1】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('war_eternal'),
                        set: (v) => setKeywordEnabled('war_eternal', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_hundred_year_lapis_brilliance',
                        label: '♼百年琉璃光',
                        type: 'bool',
                        desc: '允许在百年琉璃光【拜修拉】/【药师】【土】【1】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('hundred_year_lapis_brilliance'),
                        set: (v) => setKeywordEnabled('hundred_year_lapis_brilliance', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'refresh_transcendent_blue',
                        label: '♼超越极限之蓝',
                        type: 'bool',
                        desc: '允许在超越极限之蓝【姬塔】/【古兰】【提供：欧罗罗伽亚】发起后进行刷新操作。如果同时启用了刷新替换为后退，则进行后退操作。',
                        get: () => getKeywordEnabled('transcendent_blue'),
                        set: (v) => setKeywordEnabled('transcendent_blue', v),
                        cls: 'refresh hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_layout_change',
                        label: '🙀允许变更游戏风格',
                        desc: '允许对游戏进行额外CSS加载。默认加载工坊CSS。',
                        type: 'bool',
                        path: 'danger_mode.enable_layout_change',
                        cls: 'stylish',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_layout_change',
                        label: '🙀使用触屏模式',
                        desc: '使用方便触摸的风格。',
                        type: 'bool',
                        path: 'option.enable_touch_mode',
                        cls: 'stylish',
                        danger_mode: false,
                    },
                    {
                        key: 'replace_refresh_with_back',
                        label: '🙀刷新替换为后退',
                        desc: '允许在触发刷新时替换为后退操作。在后退代替刷新时有可能导致游戏框架重载失败，这是游戏架构问题，反复遇到时请关闭该选项。',
                        type: 'bool',
                        path: 'refresh.use_back',
                        cls: 'options hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_drop_notify',
                        label: '⏺️允许掉落提示',
                        desc: '允许在掉落稀有道具*（绯绯色金/沙漏）时进行通知。',
                        type: 'bool',
                        path: 'option.enable_drop_notify',
                        cls: 'options hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_hide_left_sidebar',
                        label: '️⏺️关闭左侧边栏',
                        desc: '允许在非风格模式下关闭左侧边栏。',
                        type: 'bool',
                        path: 'option.enable_hide_left_sidebar',
                        cls: 'options hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_hide_right_sidebar',
                        label: '️⏺️关闭右侧边栏',
                        desc: '允许在非风格模式下关闭右侧边栏。',
                        type: 'bool',
                        path: 'option.enable_hide_right_sidebar',
                        cls: 'options hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_scroller',
                        label: '️⏺️允许拖拽操作',
                        desc: '允许桌面版使用拖拽来进行页面滚动操作。',
                        type: 'bool',
                        path: 'option.enable_scroller',
                        cls: 'options hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'enable_bookmark',
                        label: '✈允许书签',
                        desc: '允许启用书签插件。书签插件将在窗口最右侧创建书签列，允许快速跳转。',
                        type: 'bool',
                        path: 'bookmark.enabled',
                        cls: 'redirect',
                        danger_mode: false,
                    },
                    {
                        key: 'allow_auto_redirect',
                        label: '✈允许跳过结算',
                        desc: '允许在进入结算页面时跳转到指定页面。',
                        type: 'bool',
                        path: 'redirect.enabled',
                        cls: 'redirect hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'auto_redirect_hash',
                        label: '✈跳转对象',
                        desc: '跳过结算时的跳转对象链接',
                        type: 'text',
                        path: 'redirect.current',
                        cls: 'redirect hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'random_factor_1',
                        label: '随机数1',
                        desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。',
                        type: 'number',
                        path: 'delay.factors[0]',
                        cls: 'params hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'random_factor_2',
                        label: '随机数2',
                        desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。',
                        type: 'number',
                        path: 'delay.factors[1]',
                        cls: 'params hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'random_factor_3',
                        label: '随机数3',
                        desc: '生成随机延迟的参数之一。生成的延迟不会小于该值。',
                        type: 'number',
                        path: 'delay.factors[2]',
                        cls: 'params hidden',
                        danger_mode: false,
                    },
                    {
                        key: 'normal_mode_ratio',
                        label: '普通模式延迟参数',
                        desc: '生成随机延迟的倍率。',
                        type: 'number',
                        path: 'delay.ratio.normal',
                        cls: 'params hidden'
                    },
                    {
                        key: 'hunter_mode',
                        label: '⚠允许风险模式',
                        desc: '允许启用风险模式。非风险模式下，工坊不会对游戏进行直接操作或修改表现方式，类似于太郎的工作模式。风险模式下，工坊存在对游戏进行部分直接干预，有可能导致处罚。工坊作者不对产生的处罚承担任何责任，请在充分理解风险的情况下启用。',
                        type: 'bool',
                        path: 'danger_mode.enabled',
                        cls: 'danger bold',
                        danger_mode: false,
                    },
                    {
                        key: 'auto_raid_select',
                        label: '⚠开启猎金模式',
                        desc: '自动进入首个大巴副本',
                        type: 'bool',
                        path: 'danger_mode.auto_raid_select',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'auto_raid_contribution',
                        label: '⚠猎金模式贡献阈值',
                        desc: '超过阈值时自动退出副本至副本选择界面',
                        type: 'text',
                        path: 'danger_mode.contribution',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'enable_filter',
                        label: '⚠开启筛选模式',
                        desc: '允许过滤剩余血量过低，或参战人数过多的救援。',
                        type: 'bool',
                        path: 'danger_mode.filtering',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'filter_by_asc',
                        label: '⚠血量排序(升序)',
                        desc: '筛选模式下，根据血量低在前进行排序。',
                        type: 'bool',
                        path: 'danger_mode.filtering_by_asc',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'enable_auto_click',
                        label: '⚠启用自动点击',
                        desc: '允许在进入副本后开启自动战斗。现处于测试模式，在游戏背景过亮的情况下会导致计算失效。',
                        type: 'bool',
                        path: 'danger_mode.auto_auto',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'enable_auto_enter',
                        label: '⚠启用自动进入副本',
                        desc: '允许在召唤石选择界面自动进入副本。',
                        type: 'bool',
                        path: 'danger_mode.auto_enter',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'enable_auto_skip_scene',
                        label: '⚠启用自动跳过剧情',
                        desc: '允许在触发剧情时自动跳过剧情。',
                        type: 'bool',
                        path: 'danger_mode.auto_skip_scene',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'enable_auto_summon',
                        label: '⚠启用自动使用召唤',
                        desc: '允许在开启自动使用召唤时，按顺序自动使用召唤',
                        type: 'bool',
                        path: 'danger_mode.auto_summon',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'auto_summon_prefer',
                        label: '⚠自动召唤优先顺序',
                        desc: '自动召唤会按照优先顺序依次释放，不在该顺序列表中的将从前到后释放',
                        type: 'text',
                        path: 'danger_mode.auto_summon_prefer',
                        cls: 'danger',
                        danger_mode: true,
                    },
                    {
                        key: 'danger_mode_ratio',
                        label: '⚠风险模式延迟参数',
                        desc: '生成随机延迟的倍率。',
                        type: 'number',
                        path: 'delay.ratio.hunt',
                        cls: 'danger hidden',
                        danger_mode: false,
                    },
                ];
                // endregion

                // region UI：开关按钮

                const createBtn = (text, position = 1, callback) => {
                    const btn = document.createElement('div');
                    btn.textContent = text;
                    btn.classList.add('floating');
                    btn.style.bottom = `${(1.5 + (position - 1) * 4)}rem`;
                    btn.addEventListener('click', callback);
                    document.body.appendChild(btn);
                    return btn;
                }

                createBtn('⚙', 1, async () => {
                    panel_container.classList.toggle('deactivated');
                    if (panel_container.classList.contains('hidden')) {
                        panel_container.classList.remove('hidden');
                    }
                    await utils.safe_actions.print.ensure_permission();
                });
                if (utils.urls.is_bonus_stock() || utils.urls.is_recycle() || utils.urls.is_decompose()) {
                    createBtn('☑', 2, () => {
                        utils.danger_actions.select_item(
                            '.btn-item' + (utils.urls.is_recycle() || utils.urls.is_decompose() ? '[data-ico-ex-skill]' : '') ).then(() => {
                        });
                    })
                }

                if (utils.urls.is_present()) {
                    createBtn('⚔️', 3, async () => {
                        await utils.tools.smartClick(
                            document.querySelector('.btn-recycle.weapon.btn-order-recycle')
                        )
                    });
                    createBtn('🧙', 2, async () => {
                        await utils.tools.smartClick(
                            document.querySelector('.btn-recycle.summon.btn-order-recycle')
                        )
                    });
                }

                if (utils.urls.is_weapon_list()) {
                    createBtn('☑', 2, async () => {
                        utils.info.one_click_enhance = {
                            bookmark: location.href,
                        };
                        location.href = utils.tools.getEnhanceURL();
                    })
                }

                if (utils.urls.is_enhance()) {
                    createBtn('🥤', 2, async () => {
                        await utils.tools.smartClick(
                            document.querySelector('#sub_contents > div.cnt-list-equipment > div.prt-tab-content.active > div > div > div.prt-order-middle > div > div > div:nth-child(1)')
                        )
                    })
                }

                if (utils.urls.is_material_select()) {
                    const use = createBtn('⭕️', 2, async () => {
                        await utils.tools.smartClick(
                            document.querySelector('#sub_contents > div.cnt-material > div.prt-enhance-detail.prt-module-enhancement > div.prt-order-bottom > div > div.btn-use-item')
                        )
                        use.remove();
                        createBtn('🔙', 2 , async () => {
                            if (utils.info.one_click_enhance.bookmark !== '') {
                                location.href = utils.info.one_click_enhance.bookmark;
                                utils.info.one_click_enhance.bookmark = '';
                            }
                        })
                    })
                }
                // endregion

                // region UI：面板框
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
                titleClose.addEventListener('click', () => {
                    panel_container.classList.toggle('deactivated');
                })
                titleReset.textContent = '❕️'
                titleReset.title = '重置当前配置（※适用于有功能处于失效时）';
                titleReset.addEventListener('click', () => {
                    localStorage.clear();
                    location.reload();
                })
                titleText.textContent = '榭洛工坊 v' + version;
                title.classList.add('panel-title');
                title.appendChild(titleText);
                title.appendChild(titleIcons);
                titleIcons.appendChild(titleReset);
                titleIcons.appendChild(titleClose);
                panel.appendChild(title);
                // endregion

                // region UI：即时刷新
                const reloadRow = document.createElement('div');
                reloadRow.classList.add('panel-reload');
                const reloadLabel = document.createElement('label');
                reloadLabel.setAttribute('for', 'reloadInput');
                reloadLabel.textContent = '修改配置后立即刷新';
                reloadLabel.classList.add('panel-label');
                const reloadInput = document.createElement('input');
                reloadInput.type = 'checkbox';
                reloadInput.checked = true;
                reloadInput.id = 'reloadInput';
                reloadRow.appendChild(reloadLabel);
                reloadRow.appendChild(reloadInput);
                panel.appendChild(reloadRow);

                utils.ui.separator.create(panel);
                // endregion

                // region UI：字段渲染
                FIELDS.forEach(field => {
                    const row = document.createElement('div');
                    if (field.key === 'hunter_mode') {
                        utils.ui.separator.create(panel);
                    }
                    row.classList.add('panel-row');
                    if (field.cls !== '') {
                        field.cls.split(' ').forEach((cls) => {
                            row.classList.add(cls);
                        })
                    }

                    const label = document.createElement('label');
                    label.classList.add('panel-label');
                    label.textContent = field.label || field.key;
                    label.id = `${field.key}_label`;

                    let curVal;
                    if (field.get) {
                        curVal = field.get();
                    } else {
                        curVal = getByPath(cfg.state, field.path);
                        if (typeof curVal === 'undefined') {
                            curVal = getByPath(defaultsObj, field.path);
                        }
                    }

                    let input = document.createElement('input');
                    input.id = `${field.key}_id`;
                    label.setAttribute('for', input.id);
                    label.title = field.desc;
                    if (field.type === 'bool') {
                        input.type = 'checkbox';
                        input.checked = !!curVal;
                        input.addEventListener('change', () => {
                            if (field.set) {
                                field.set(input.checked);
                            } else {
                                setByPath(cfg.state, field.path, input.checked);
                                cfg._save();
                            }
                            if (reloadInput.checked) location.reload();
                        });
                    } else if (field.type === 'number') {
                        input.type = 'number';
                        input.value = curVal ?? '0';
                        input.style.width = '90px';
                        input.addEventListener('blur', () => {
                            const v = parseInt(input.value, 10);
                            if (field.set) {
                                field.set(v);
                            } else {
                                setByPath(cfg.state, field.path, v);
                                cfg._save();
                            }
                            if (reloadInput.checked) location.reload();
                        });
                    } else {
                        // text
                        input.type = 'text';
                        input.value = curVal ?? '';
                        input.addEventListener('change', () => {
                            const v = input.value;
                            if (field.set) {
                                field.set(v);
                            } else {
                                setByPath(cfg.state, field.path, v);
                                cfg._save();
                            }
                            if (reloadInput.checked) location.reload();
                        });
                    }

                    if (field.danger_mode && config.danger_mode.enabled === false) {
                        input.setAttribute('disabled', '');
                        row.classList.add('hidden');
                    }

                    row.appendChild(label);
                    row.appendChild(input);
                    panel.appendChild(row);
                });
                // endregion

                // region 按钮组
                utils.ui.separator.create(panel);
                const btn_group_func = document.createElement('div');
                btn_group_func.classList.add('btn-group');
                // endregion

                // region 按钮 设置当前 hash 为跳转对象 -> redirect.current
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
                // endregion

                // region 显示用按钮组
                const btn_group = document.createElement('div');
                btn_group.classList.add('btn-group');
                // endregion

                // region 按钮 显示或关闭选项
                const btn_toggle_refresh = document.createElement('button');
                btn_toggle_refresh.textContent = '显示/隐藏刷新选项'
                btn_toggle_refresh.addEventListener('click', () => {
                    panel.querySelectorAll('.refresh').forEach(param => {
                        param.classList.toggle('hidden');
                    })
                })
                btn_group.appendChild(btn_toggle_refresh);
                // endregion

                // region 按钮 显示或关闭参数
                const btn_toggle_delay_param = document.createElement('button');
                btn_toggle_delay_param.textContent = '显示/隐藏延迟参数'
                btn_toggle_delay_param.addEventListener('click', () => {
                    panel.querySelectorAll('.params').forEach(param => {
                        param.classList.toggle('hidden');
                    })
                })
                btn_group.appendChild(btn_toggle_delay_param);

                const waw = document.createElement('div');
                waw.classList.add('panel-row');
                waw.classList.add('waw');
                waw.classList.add('options');
                waw.classList.add('hidden');
                const warningAudioSelector = document.createElement('select');
                warningAudioSelector.id = 'warningAudioSelector';
                const warningAudioList = [
                    {
                        id: 1, name: '不得不哈'
                    },
                    {
                        id: 2, name: '夜袭小曲'
                    },
                    {
                        id: 3, name: '圆神'
                    },
                ]
                warningAudioList.forEach((item) => {
                    const option = document.createElement('option');
                    option.textContent = item.name;
                    option.value = item.id;
                    warningAudioSelector.appendChild(option);
                })
                const warningAudioSetButton = document.createElement('button');
                warningAudioSetButton.textContent = '设置警告音频';
                warningAudioSetButton.addEventListener('click', () => {
                    config.option.warning_audio = warningAudioSelector.value;
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                })
                warningAudioSelector.selectedIndex = warningAudioList.findIndex((__item) => {
                    return __item.id === parseInt(config.option.warning_audio);
                });
                waw.appendChild(warningAudioSelector)
                waw.appendChild(warningAudioSetButton);

                panel.appendChild(waw);
                // endregion

                // region 按钮 显示或关闭重定向
                const btn_toggle_redirect = document.createElement('button');
                btn_toggle_redirect.textContent = '显示/隐藏重定向选项'
                btn_toggle_redirect.addEventListener('click', () => {
                    panel.querySelectorAll('.redirect').forEach(param => {
                        param.classList.toggle('hidden');
                    })
                })
                btn_group.appendChild(btn_toggle_redirect);
                // endregion

                // region 按钮 显示或关闭重定向
                const btn_toggle_options = document.createElement('button');
                btn_toggle_options.textContent = '显示/隐藏配置选项'
                btn_toggle_options.addEventListener('click', () => {
                    panel.querySelectorAll('.options').forEach(param => {
                        param.classList.toggle('hidden');
                    })
                })
                btn_group.appendChild(btn_toggle_options);
                // endregion

                // region 书签管理
                // 书签本体
                // 面板书签管理部分
                const bm_frame = document.createElement('div');
                bm_frame.classList.add('panel-row');
                bm_frame.classList.add('redirect');
                bm_frame.classList.add('bm-frame');
                bm_frame.classList.add('hidden');

                const bookmark_add = document.createElement('div');
                bookmark_add.classList.add('bm-content');

                const bm_input = document.createElement('input');
                bm_input.type = 'text';
                bm_input.value = `我的书签${config.bookmark.bookmarks.length}`;
                bm_input.id = 'bm_input';
                bm_input.classList.add('bm-input');
                const bm_add = document.createElement('button');
                bm_add.textContent = '添加书签';
                bm_add.addEventListener('click', () => {
                    config.bookmark.bookmarks.push({
                        name: bm_input.value === '' ? `我的书签${config.bookmark.bookmarks.length}` : bm_input.value,
                        hash: location.hash,
                    });
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                })
                bookmark_add.appendChild(bm_input);
                bookmark_add.appendChild(bm_add);

                const bookmark_del = document.createElement('div');
                bookmark_del.classList.add('bm-content');

                const bm_select = document.createElement('select');
                bm_select.id = 'bm-select';
                bookmark_del.appendChild(bm_select);
                bm_frame.appendChild(bookmark_add);

                const bm_delete = document.createElement('button');
                bm_delete.textContent = '删除书签';
                bm_delete.addEventListener('click', () => {
                    config.bookmark.bookmarks = config.bookmark.bookmarks.filter(bookmark => bookmark.name !== bm_select.value);
                    const bookmark_body = document.querySelector('.bookmark');
                    if (bookmark_body) {
                        document.querySelector(`.bookmark-item[name="${bm_select.value}"]`).remove();
                    }
                    cfg._save();
                    if (reloadInput.checked) location.reload();
                })
                bookmark_del.appendChild(bm_delete);
                if (config.bookmark.bookmarks.length === 0) {
                    bookmark_del.classList.add('hidden');
                }
                bm_frame.appendChild(bookmark_del);

                if (config.bookmark.enabled === true) {
                    const bookmark_frame = document.createElement('div');
                    bookmark_frame.classList.add('bookmark');

                    /* bookmark structure
                        {
                            name: "主页",
                            hash: "#mypage",
                        }
                    */
                    config.bookmark.bookmarks.forEach((bookmark, index) => {
                        const item = document.createElement('div');
                        item.classList.add('bookmark-item');
                        item.setAttribute('name', bookmark.name);
                        const label = `${(index + 1).toString().padStart(2, '0')} ${bookmark.name}`;
                        item.textContent = label;
                        item.addEventListener('click', () => {
                            utils.redirect.goto({
                                hash: bookmark.hash,
                                force: true,
                                immediately: true,
                            })
                        });
                        const option = document.createElement('option');
                        option.textContent = label;
                        option.value = bookmark.name;
                        item.appendChild(document.createElement('span'));
                        bm_select.appendChild(option);
                        bookmark_frame.appendChild(item);
                    })

                    document.body.appendChild(bookmark_frame);
                }

                // region 注册导入导出
                const imex_frame = document.createElement('div');
                imex_frame.classList.add('bm-content');
                const import_file = document.createElement('input');
                import_file.type = 'file';
                import_file.id = 'import_bm_file';
                import_file.accept = '.json';
                const import_btn = document.createElement('button');
                import_btn.textContent = '导入书签';
                const export_btn = document.createElement('button');
                export_btn.textContent = '导出书签';

                imex_frame.appendChild(import_file);
                imex_frame.appendChild(import_btn);
                import_btn.addEventListener('click', () => {
                    if (import_file.files.length === 0) return;
                    const file = import_file.files[0];
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        try {
                            config.bookmark.bookmarks = JSON.parse(e.target.result);
                            cfg._save();
                            if (reloadInput.checked) location.reload();
                        } catch (err) {
                            console.error("JSON 解析失败:", err);
                        }
                    };
                    reader.readAsText(file, "utf-8");
                })
                imex_frame.appendChild(export_btn);
                export_btn.addEventListener('click', () => {
                    utils.tools.exportJSON(config.bookmark.bookmarks, 'sierokarte-bookmark.json');
                })

                bm_frame.appendChild(imex_frame);

                // endregion

                // region 向文档注册类
                document.body.classList.add('sierokarte');
                // 插入功能性按钮组
                panel.appendChild(btn_group_func);
                // 插入显示类按钮组
                utils.ui.separator.create(panel);
                panel.appendChild(btn_group);
                // 插入书签管理
                panel.appendChild(bm_frame);
                // 阻止面板冒泡
                panel.addEventListener('click', (e) => {
                    e.stopPropagation();
                })
                // endregion

                // endregion

                // region 创建页脚
                if (config.danger_mode.enable_layout_change && !navigator.userAgent.includes('iOS')) {
                    const footer = document.createElement('div');
                    footer.classList.add('siero-footer');
                    const wrapper = document.getElementById('wrapper');
                    const btns = [
                        {
                            'id': 'back',
                            'label': '返回',
                            'order': 1,
                            'action': () => {
                                utils.redirect.back();
                            }
                        },
                        {
                            'id': 'reload',
                            'label': '刷新',
                            'order': 4,
                            'action': () => {
                                utils.redirect.reload(true);
                            }
                        },
                        {
                            'id': 'home',
                            'label': '主页',
                            'order': 5,
                            'action': () => {
                                utils.redirect.goto({
                                    hash: '#mypage',
                                    force: true,
                                    immediately: true,
                                });
                            }
                        },
                        {
                            'id': 'assist',
                            'label': '多人',
                            'order': 3,
                            'action': () => {
                                utils.redirect.goto({
                                    hash: '#quest/assist',
                                    force: true,
                                    immediately: true,
                                });
                            }
                        },
                        {
                            'id': 'replicard',
                            'label': '转世',
                            'order': 2,
                            'action': () => {
                                utils.redirect.goto({
                                    hash: '#replicard',
                                    force: true,
                                    immediately: true,
                                });
                            }
                        }
                    ]
                    btns.sort((a, b) => a.order - b.order);
                    btns.forEach(btn => {
                        const btn_item = document.createElement('div');
                        btn_item.classList.add('footer-btn-item');
                        btn_item.textContent = btn.label;
                        btn_item.id = btn.id;
                        btn_item.addEventListener('click', btn.action);
                        footer.appendChild(btn_item);
                    })

                    wrapper.appendChild(footer);
                }
                // endregion

                // region 插入面板动画
                // 插入容器
                const panel_container = document.createElement('div');
                panel_container.classList.add('panel-container');
                panel_container.classList.add('fade');
                panel_container.classList.add('deactivated');
                // 阻止首次打开页面时播放动画
                panel_container.classList.add('hidden');

                // 插入背景 允许背景关闭面板
                const panel_bg = document.createElement('div');
                panel_bg.classList.add('panel-background');
                panel_bg.addEventListener('click', () => {
                    panel_container.classList.toggle('deactivated');
                })

                // 插入面板到背景
                panel_bg.appendChild(panel);
                // 插入背景到容器
                panel_container.appendChild(panel_bg);
                // 插入容器到文档身体
                document.body.appendChild(panel_container);
            }
        },
        random: () => {
            const ratio = config.danger_mode.enabled ? config.delay.ratio.hunt : config.delay.ratio.normal;
            let delay = 0;
            config.delay.factors.forEach((i) => {
                const min = i;
                const max = i * ratio * 10;
                delay += Math.floor(Math.random() * (max - min + 1)) + min;
            })
            return Math.round(delay / config.delay.factors.length);
        },
        redirect: {
            back: () => {
                setTimeout(history.go.bind(history, -1), utils.random());
            },
            reload: (force = false) => {
                if (config.refresh.use_back) {
                    utils.redirect.back()
                } else if (force) {
                    location.reload();
                } else {
                    setTimeout(location.reload.bind(location), utils.random());
                }
            },
            goto: ({hash = config.redirect.current, force = false, immediately = false} = {}) => {
                const delay = immediately ? 0 : utils.random();
                //console.debug(`延迟随机完毕...${delay}`);
                setTimeout(() => {
                    if (force) {
                        if (hash && hash.startsWith('#')) {
                            location.hash = hash.slice(1); // 或者：location.href = hash;
                        } else if (hash) {
                            window.open(`${location.origin}/${hash}`, '_self');
                        } else {
                            location.reload();
                        }
                    } else {
                        location.href = hash || location.href;
                    }
                }, delay);
            },
            assist: () => {
                utils.redirect.goto({hash: config.redirect.assist});
            },
            auto: () => {
                if (!config.redirect.enabled) return;
                if (!utils.urls.is_result()) return;
                if (config.redirect.current === '') return;
                utils.redirect.goto({force: true});
            },
        },
        safe_actions: {
            print: {
                async ensure_permission() {
                    if (Notification.permission === 'default') {
                        await Notification.requestPermission();
                    }
                },
                async drop(title, body, icon) {
                    if (Notification.permission === 'granted') {
                        new Notification(title, {
                            body: body,
                            icon: icon,
                        })
                    }
                }
            },
            play: {
                getAudioURL: (target /** @typeParam int*/) => {
                    const padded = String(target).padStart(2, '0');
                    return `https://cdn.jsdelivr.net/gh/Tao11-21/gbf-sierokarte@main/warning_${padded}.mp3`
                },
                warning: async () => {
                    const {getAudioURL} = utils.safe_actions.play;
                    const warning = new Audio(getAudioURL(config.option.warning_audio));
                    warning.loop = true;
                    await warning.play();
                }
            },
            watch: {
                async enemyHP(callback) {
                    const el = await utils.tools.waitForQ('.btn-enemy-gauge.prt-enemy-percent.alive > .txt-gauge-value');
                    if (!el) {
                        throw new Error("未找到BOSS HP槽");
                    } else {
                        console.debug('已定位BOSS HP元素', el, el.textContent);
                    }

                    const isZero = () => {
                        const v = (el.textContent ?? "").trim();
                        return v === "0" || Number(v) === 0;
                    };

                    // 若一开始就是 0，立即触发
                    if (isZero()) {
                        callback();
                        return () => {
                        }; // no-op unwatch
                    }

                    const obs = new MutationObserver(() => {
                        if (isZero()) {
                            obs.disconnect();
                            callback();
                        }
                    });

                    obs.observe(el, {
                        childList: true,
                        characterData: true,
                        subtree: true
                    });

                    return () => obs.disconnect(); // 返回取消监视函数
                },
                async contribution(callback) {
                    const el = await utils.tools.waitForQ('.lis-user.player > .txt-point');
                    if (!el) {
                        throw new Error("未找到贡献元素");
                    } else {
                        console.debug('已定位贡献元素', el, el.textContent);
                    }

                    const biggerThan = () => {
                        const v = (el.textContent ?? "").trim().replace(/pt/g, '');
                        console.debug('贡献阈值为', config.danger_mode.contribution, '当前贡献为', v);
                        return Number(v) >= config.danger_mode.contribution;
                    };

                    // 若一开始就是 0，立即触发
                    if (biggerThan()) {
                        callback();
                        return () => {
                        }; // no-op unwatch
                    }

                    const obs = new MutationObserver(() => {
                        if (biggerThan()) {
                            obs.disconnect();
                            callback();
                        }
                    });

                    obs.observe(el, {
                        childList: true,
                        characterData: true,
                        subtree: true
                    });

                    return () => obs.disconnect(); // 返回取消监视函数
                },
                async bossDown(callback) {
                    await utils.safe_actions.watch.watchPop('.pop-usual.pop-rematch-fail.pop-show', callback)
                },
                async errorPop(callback) {
                    await utils.safe_actions.watch.watchPop('.pop-usual.common-pop-error.pop-show', callback);
                },
                async watchPop(selector, callback) {
                    const root = await utils.tools.waitForQ('#mobage-game-container > div[id^="pop"]:not([id="pop-chat"])');
                    if (!root) throw new Error("未找到弹窗。");

                    // 若一开始就已存在，立即触发
                    if (root.querySelector(selector)) {
                        callback(root.querySelector(selector));
                        return () => {
                        };
                    }

                    const observer = new MutationObserver(() => {
                        const el = root.querySelector(selector);
                        if (el) {
                            observer.disconnect();
                            callback(el);
                        }
                    });

                    observer.observe(root, {
                        childList: true,
                        subtree: true
                    });

                    return () => observer.disconnect(); // 取消监视
                },
            },
        },
        tools: {
            getEnhanceURL: () => {
                const url = location.origin + '/#enhancement/weapon/list_all/1/' + utils.tools.getFirstWeaponId() + '/' + new URL(location.href).hash.split('/')[3] + '/' + new URL(location.href).hash.split('/')[4] + '/1';
                console.debug(url);
                return url;
            },
            getFirstWeaponId: () => {
                const id = document.querySelector('#lis-item > div:nth-child(1)').getAttribute('data-item-id');
                console.debug(`firstElement id is: ${id}`);
                return id;
            },
            sortBySummonCodeOrder(nodeListOrArray, orderStr, attr = 'summon-code') {
                const arr = Array.from(nodeListOrArray);
                orderStr = orderStr === undefined ? '' : orderStr;
                const order = orderStr
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

                const rank = new Map(order.map((code, i) => [code, i]));

                const indexed = arr.map((el, idx) => ({el, idx}));

                indexed.sort((a, b) => {
                    const ca = a.el.getAttribute(attr);
                    const cb = b.el.getAttribute(attr);

                    const ra = rank.has(ca) ? rank.get(ca) : Infinity;
                    const rb = rank.has(cb) ? rank.get(cb) : Infinity;

                    if (ra !== rb) return ra - rb;
                    return a.idx - b.idx;
                });

                return indexed.map(x => x.el);
            },
            exportJSON(obj, filename = "data.json") {
                // 序列化并缩进
                const jsonStr = JSON.stringify(obj, null, 2);

                // 创建 blob
                const blob = new Blob([jsonStr], {type: "application/json"});

                // 创建下载链接
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();

                // 释放 URL 对象
                URL.revokeObjectURL(url);
            },
            observeClass(targetEl, targetClass, onMatch) {
                const observer = new MutationObserver(mutations => {
                    for (const m of mutations) {
                        if (m.type === 'attributes' && m.attributeName === 'class') {
                            if (targetEl.classList.contains(targetClass)) {
                                onMatch();
                            }
                        }
                    }
                });

                observer.observe(targetEl, {
                    attributes: true,
                    attributeFilter: ['class']
                });

                return observer;
            },
            save_drop_log: async (battle_date, data) => {
                if (uid === 0) return;
                const is_trial = data.is_trial_battle;
                const d = data.result_data;
                const battle_log = {
                    uid: uid,
                    is_trial: is_trial,
                    battle_date: battle_date,
                    battle_json: JSON.stringify(d),
                }
                await utils.cloud.write_battle_log(battle_log);
            },
            parseRewards(payload, groupBy = "key") {
                const rl = payload?.reward_list ?? {};
                const acc = new Map(); // key or id -> item

                for (const [slot, v] of Object.entries(rl)) {
                    if (Array.isArray(v)) continue;              // 该档位无掉落
                    if (v && typeof v === "object") {
                        for (const [k, item] of Object.entries(v)) {
                            const gid = groupBy === "id" ? item.id : k;   // 选择聚合维度
                            if (!acc.has(gid)) {
                                acc.set(gid, {
                                    key: k,
                                    id: item.id,
                                    name: item.name,
                                    rarity: item.rarity,
                                    item_kind: item.item_kind,
                                    count: 0,
                                    by_slot: {}
                                });
                            }
                            const rec = acc.get(gid);
                            const c = Number(item.count ?? 1) || 0;
                            rec.count += c;
                            rec.by_slot[slot] = (rec.by_slot[slot] ?? 0) + c;
                        }
                    }
                }
                // console.debug(Array.from(acc.values()));
                return Array.from(acc.values());
            },
            drop_notify: async (battle_date, data) => {
                const {drop} = utils.safe_actions.print;
                const rewards = data.result_data?.rewards;
                const result = utils.tools.parseRewards(rewards);
                await utils.tools.save_drop_log(battle_date, data);
                let title = '[工坊]获得蓝箱道具';
                let body = '';
                let icon = icon_url.mine;
                result.forEach(r => {
                    const t = r.name
                    const blue = r.by_slot.hasOwnProperty(11);
                    if (blue) {
                        if (r.name !== 'ヒヒイロカネ') {
                            body += `${blue ? '[蓝箱]' : ''} ${t} x ${r.count}\n`;
                        } else {
                            icon = icon_url.gold_brick;
                            title.replace('蓝箱道具', '绯绯金')
                            body += `${blue ? '[蓝箱]' : ''} 获得了绯绯金！${t} x ${r.count}`;
                        }
                    }
                })
                if (body !== '') {
                    await drop(title, body, icon);
                }
            },
            ensureBtnObserver(runOnce) {
                const mo = new MutationObserver(() => {
                    const b = document.querySelector('.btn-usual-ok.se-quest-start');
                    if (b && utils.tools.isVisibleNow(b)) runOnce(b);
                });
                mo.observe(document.body, {childList: true, subtree: true});
                // 30 秒后自动关闭
                setTimeout(() => mo.disconnect(), 30000);
            },
            tryParseJSON(s) {
                try {
                    return JSON.parse(s);
                } catch (e) {
                    return {};
                }
            },
            isVisibleNow(el) {
                if (!el) return false;
                const st = getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden') return false;
                const w = el.offsetWidth, h = el.offsetHeight;
                return (w > 0 && h > 0);
            },
            register_scroller() {
                new MouseScroller(document.querySelector('.SdEyhW_kE0xoDznTZ5Wr-'), {
                    direction: 'y',      // 可选: 'x', 'y', 'both'
                    damping: 0.95,          // 惯性阻尼系数 (0 ~ 1)
                    minVelocity: 0.5        // 惯性停止的最小速度
                });
            },
            async smartClick(el, idx = 1) {
                setTimeout(() => {
                    const tap = $.Event('tap'); // 每次触发前 new
                    $(el).trigger(tap);
                }, 250 * idx);
            },
            waitForQ(selector, pred = (el) => !!el, {interval = 10, timeout = 5000} = {}) {
                return new Promise((resolve, reject) => {
                    const t0 = Date.now();
                    const tick = () => {
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
            separator: {
                create(parent) {
                    // 添加分隔行
                    const separator = document.createElement('div');
                    separator.classList.add('separator');
                    parent.appendChild(separator);
                    // endregion
                }
            },
            unload_panel: () => {
                const panel = document.querySelector('div.config-panel');
                const toggle = document.querySelectorAll('div.floating');
                if (panel) {
                    panel.remove();
                }
                if (toggle.length > 0) {
                    toggle.forEach(t => t.remove());
                }
            }
        },
        urls: {
            get_xhr_type: (url) => {
                return url.pathname.split('/').pop() || '';
            },
            is_battle_type: (url) => {
                if (!utils.urls.is_json(url)) return false;
                return defaults.set.includes(utils.urls.get_xhr_type(url));
            },
            is_home: () => {
                // console.debug('检测当前页面为主页：', result);
                return location.href.includes('#mypage');
            }, // 友召选择界面？
            is_json: (url) => {
                // console.debug('检测url，对象为：', url);
                return url.pathname.endsWith('.json');
            }, // 剧情界面？
            is_list_request: (url) => {
                return url.href.includes('rest/quest/assist/search/assist_list');
            }, // 副本界面？
            is_multi_raid: (url = new URL(location.href)) => {
                // console.debug(`检测${url.href}页面为多人副本：`, result);
                return url.href.includes('/#raid_multi/');
            },
            is_quest: () => {
                // console.debug('检测当前页面为副本选择界面：', result);
                return location.href.endsWith('#quest/assist');
            },
            is_raid: (url = new URL(location.href)) => {
                const href = url.href;
                // console.debug(`检测${href}当前页面为单人副本：`, result);
                return href.includes('#raid/') && !href.includes('#raid_multi/');
            },
            is_recycle: (url = new URL(location.href)) => {
                return url.href.includes('#recycle');
            },
            is_decompose: (url = new URL(location.href)) => {
                return url.href.includes('#decompose');
            },
            is_result: (url = new URL(location.href)) => {
                // console.debug(`检测${url.href}页面为结算页面：`, result);
                return url.href.includes('#result');
            },
            is_balancing: (url = new URL(location.href)) => {
                // console.debug(`检测${url.href}请求结果是否为副本结果`, result);
                return url.href.includes('/resultmulti/content/index');
            },
            is_scene: () => {
                // console.debug('检测当前页面为剧情界面：', result);
                return location.href.includes('scene');
            },
            is_spsl: () => {
                const result = location.href.includes('supporter');
                console.debug('检测当前页面为友召选择界面：', result);
                return result;
            },
            is_bonus_stock: () => {
                return location.href.includes('#bonus_stock');
            },
            is_present: () => location.href.includes('#present'),
            has_uid: (url) => {
                if (url.href.includes('uid=')) {
                    uid = url.searchParams.get('uid');
                }
            },
            is_weapon_detail: () => location.href.includes('#container/detail/weapon'),
            is_weapon_list: () => location.href.includes('#container/list/weapon'),
            is_enhance: () => location.href.includes('#enhancement/weapon/list_all'),
            is_material_select: () => location.href.includes('#enhancement/weapon/material'),
        }
    }
    // endregion

    // region 允许拖动滑动
    class MouseScroller {
        constructor(container, options = {}) {
            this.container = container;
            this.options = {
                direction: options.direction || 'both',
                damping: options.damping ?? 0.95,
                minVelocity: options.minVelocity ?? 0.5,
                maxVelocity: options.maxVelocity ?? 100, // ✅ 限速
            };

            this.isDragging = false;
            this.startX = 0;
            this.startY = 0;
            this.scrollLeft = 0;
            this.scrollTop = 0;
            this.velocityX = 0;
            this.velocityY = 0;
            this._lastMoveX = 0;
            this._lastMoveY = 0;
            this._lastMoveTime = 0;
            this.rafId = null;

            this._onMouseDown = this._onMouseDown.bind(this);
            this._onMouseMove = this._onMouseMove.bind(this);
            this._onMouseUp = this._onMouseUp.bind(this);
            this._inertiaLoop = this._inertiaLoop.bind(this);

            this._addEvents();
        }

        _addEvents() {
            this.container.addEventListener('mousedown', this._onMouseDown);
            document.addEventListener('mouseup', this._onMouseUp);
            document.addEventListener('mousemove', this._onMouseMove);
        }

        _onMouseDown(e) {
            this.isDragging = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.scrollLeft = this.container.scrollLeft;
            this.scrollTop = this.container.scrollTop;
            this.velocityX = 0;
            this.velocityY = 0;
            cancelAnimationFrame(this.rafId);
            this.container.style.cursor = 'grabbing';
        }

        _onMouseMove(e) {
            if (!this.isDragging) return;
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            const now = Date.now();

            if (this.options.direction !== 'y') {
                this.container.scrollLeft = this.scrollLeft - dx;
                this._lastMoveX = this.container.scrollLeft;
            }

            if (this.options.direction !== 'x') {
                this.container.scrollTop = this.scrollTop - dy;
                this._lastMoveY = this.container.scrollTop;
            }

            this._lastMoveTime = now;
        }

        _onMouseUp() {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.container.style.cursor = 'default';

            const now = Date.now();
            const dt = now - this._lastMoveTime || 16; // 防0除
            if (this.options.direction !== 'y') {
                this.velocityX = (this.container.scrollLeft - this._lastMoveX) / dt * 16;
                this.velocityX = Math.max(Math.min(this.velocityX, this.options.maxVelocity), -this.options.maxVelocity);
            }
            if (this.options.direction !== 'x') {
                this.velocityY = (this.container.scrollTop - this._lastMoveY) / dt * 16;
                this.velocityY = Math.max(Math.min(this.velocityY, this.options.maxVelocity), -this.options.maxVelocity);
            }

            this.rafId = requestAnimationFrame(this._inertiaLoop);
        }

        _inertiaLoop() {
            if (Math.abs(this.velocityX) > this.options.minVelocity || Math.abs(this.velocityY) > this.options.minVelocity) {
                if (this.options.direction !== 'y') {
                    this.container.scrollLeft += this.velocityX;
                    this.velocityX *= this.options.damping;
                }
                if (this.options.direction !== 'x') {
                    this.container.scrollTop += this.velocityY;
                    this.velocityY *= this.options.damping;
                }
                this.rafId = requestAnimationFrame(this._inertiaLoop);
            }
        }

        destroy() {
            cancelAnimationFrame(this.rafId);
            this.container.removeEventListener('mousedown', this._onMouseDown);
            document.removeEventListener('mouseup', this._onMouseUp);
            document.removeEventListener('mousemove', this._onMouseMove);
        }

        disable() {
            this.isDragging = false;
            this.velocityX = 0;
            this.velocityY = 0;
            cancelAnimationFrame(this.rafId);
        }
    }

    // endregion

    // region 重置任务
    const _st = window.setTimeout, _ct = window.clearTimeout;
    const _si = window.setInterval, _ci = window.clearInterval;
    const _raf = window.requestAnimationFrame, _caf = window.cancelAnimationFrame;

    const timeouts = new Set(), intervals = new Set(), rafs = new Set();

    window.setTimeout = (fn, t, ...a) => {
        const id = _st(() => {
            timeouts.delete(id);
            fn();
        }, t, ...a);
        timeouts.add(id);
        return id;
    };
    window.clearTimeout = (id) => {
        timeouts.delete(id);
        _ct(id);
    };
    window.setInterval = (fn, t, ...a) => {
        const id = _si(fn, t, ...a);
        intervals.add(id);
        return id;
    };
    window.clearInterval = (id) => {
        intervals.delete(id);
        _ci(id);
    };
    window.requestAnimationFrame = (fn) => {
        const id = _raf((ts) => {
            rafs.delete(id);
            fn(ts);
        });
        rafs.add(id);
        return id;
    };
    window.cancelAnimationFrame = (id) => {
        rafs.delete(id);
        _caf(id);
    };

    const clearAllTimers = () => {
        // 清理垃圾
        document.querySelectorAll('body > script').forEach((i) => {
            i.remove()
        });
        document.querySelectorAll('body > iframe').forEach((i) => {
            i.remove()
        });
        // 清理任务
        for (const id of timeouts) _ct(id);
        timeouts.clear();
        for (const id of intervals) _ci(id);
        intervals.clear();
        for (const id of rafs) _caf(id);
        rafs.clear();
    };

    // 统一的“地址变化”事件
    (() => {
        const fire = () => window.dispatchEvent(new Event('locationchange'));
        const {pushState, replaceState} = history;
        history.pushState = function (...args) {
            pushState.apply(this, args);
            fire();
        };
        history.replaceState = function (...args) {
            replaceState.apply(this, args);
            fire();
        };
        window.addEventListener('popstate', fire);
        window.addEventListener('hashchange', fire);
    })();

    // endregion

    // region 拦截 XHR
    const XHR = XMLHttpRequest;
    const _open = XHR.prototype.open;
    const _send = XHR.prototype.send;

    XHR.prototype.open = function (method, url, ...rest) {// 记录
        return _open.call(this, method, url, ...rest);
    };

    XHR.prototype.send = function (...args) {
        this.addEventListener('readystatechange', () => {
            if (this.readyState !== 4) return;
            try {
                // region 标准检测
                if (this.status !== 200 || this.response === 'null') return;
                //console.debug(this);
                const targetUrl = new URL(this.responseURL);

                // UID
                if (uid === 0) {
                    utils.urls.has_uid(targetUrl);
                }

                const is_gbf_origin =
                    targetUrl.hostname.endsWith('granbluefantasy.jp')
                    && !targetUrl.hostname.includes('ws.')
                    && !targetUrl.pathname.includes('ob')
                    && !targetUrl.pathname.includes('socket')
                    && !targetUrl.hostname.includes('sound')
                ;
                // console.debug(`${targetUrl.hostname}，碧蓝幻想动态源：${is_gbf_origin}`);
                if (is_gbf_origin === false) return;
                // console.debug('检测到非缓存内容，进行检查...');
                // endregion

                const raw = this.responseType === 'json'
                    ? this.response
                    : utils.tools.tryParseJSON(this.responseText);

                // region 1) 分发 battle 数据
                const is_battle_json = utils.urls.is_battle_type(targetUrl);
                // console.debug(`是否为需要检测的数据：${is_battle_json}`);
                if (is_battle_json) {
                    const scenario = raw.scenario ?? raw;
                    window.dispatchEvent(new CustomEvent('sierokarte-xhr', {
                        detail: {key: utils.urls.get_xhr_type(targetUrl), scenario}
                    }));
                    return;
                }
                // endregion

                // region 检测掉落
                if (config.option.enable_drop_notify) {
                    if (utils.urls.is_balancing(targetUrl)) {
                        const data = JSON.parse(this.response)?.option;
                        if (!data) return;
                        utils.tools.drop_notify(new Date().toISOString(), data).then(() => {
                        });
                        return;
                    }
                }
                // endregion

                const adjusted = {
                    replaced: raw, //utils.safe_actions.translate(raw, translations),
                    asString: this.responseText,
                };
                // adjusted.asString = JSON.stringify(adjusted.replaced, null, 4);

                // region 2) 改写列表响应
                if (config.danger_mode.filtering) {
                    if (utils.urls.is_list_request(targetUrl)) {
                        adjusted.replaced = {
                            assist_raids_data: utils.handle_list(raw.assist_raids_data)
                        };
                        adjusted.asString = JSON.stringify(adjusted.replaced);
                        // console.debug(`列表替换后长度为：${replaced.assist_raids_data.length}`);
                    }
                }

                // 影子覆盖，只读但可被实例级 getter 遮蔽
                try {
                    Object.defineProperty(this, 'responseText', {
                        get() {
                            return adjusted.asString;
                        }
                    });
                } catch {
                }
                try {
                    Object.defineProperty(this, 'response', {
                        get() {
                            return this.responseType === 'json' ? adjusted.replaced : adjusted.asString;
                        }
                    });
                } catch {
                }
                // endregion
            } catch (e) {
                console.error('patch error:', e);
            }
        }, {once: false});

        return _send.apply(this, args);
    };
    // endregion

    // region 注册事件
    window.addEventListener('locationchange', utils.onLoad);
    window.addEventListener('DOMContentLoaded', utils.onLoad);
    window.addEventListener('popstate', utils.onLoad);
    window.addEventListener('hashchange', utils.onLoad);
    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') utils.redirect.auto();
    });
    window.addEventListener('sierokarte-xhr', (e) => {
        const {key, scenario} = e.detail;
        utils.handle(scenario, key);
    });
    // endregion
})();
// endregion
