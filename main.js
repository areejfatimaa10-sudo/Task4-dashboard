/* ============================================================
   MoodShop Admin Dashboard — main.js
   jQuery 3.7.1 + Chart.js 4.4.4. No Bootstrap JS: dropdowns,
   the mobile drawer and page switching are plain jQuery class
   toggles against Tailwind utilities.
   ============================================================ */
$(function () {

  /* ============================================================
     UTILITIES
  ============================================================ */
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* no-op */ } }

  function debounce(fn, wait) {
    let t;
    return function () {
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait);
    };
  }

  // Tailwind class sets reused by the JS-driven state swaps
  const CLS = {
    navActive:   'bg-mood-bored text-white',
    navIdle:     'text-sidenav hover:bg-white/10 hover:text-white',
    rangeActive: 'bg-navy-900 border-navy-900 text-white',
    rangeIdle:   'border-line text-ink-600',
    pageActive:  'bg-navy-900 border-navy-900 text-white',
    pageIdle:    'border-line text-ink-600'
  };

  /* ============================================================
     MODULE: Theme (dark / light)
  ============================================================ */
  const Theme = {
    init() {
      const saved = safeGet('moodshop-theme') || 'light';
      this.apply(saved);
      $('#themeSwitch').on('click', () => this.toggle());
    },

    toggle() {
      const next = $('html').attr('data-theme') === 'dark' ? 'light' : 'dark';
      this.apply(next);
      safeSet('moodshop-theme', next);
      Charts.refreshColors();
    },

    apply(mode) {
      const dark = mode === 'dark';
      $('html').attr('data-theme', mode);
      $('#themeSwitch').attr('aria-checked', dark ? 'true' : 'false');
      $('#themeKnob')
        .toggleClass('translate-x-6', dark)
        .toggleClass('translate-x-0', !dark);
      $('#themeIcon')
        .toggleClass('bi-sun-fill text-mood-happy', !dark)
        .toggleClass('bi-moon-stars-fill text-sidenav', dark);
    }
  };

  /* ============================================================
     MODULE: Dropdowns — replaces data-bs-toggle="dropdown".
     A [data-dropdown-trigger] button followed by a sibling
     .dropdown-menu panel is all the markup that's needed.
  ============================================================ */
  const Dropdowns = {
    init() {
      $('[data-dropdown-trigger]').on('click', function (e) {
        e.stopPropagation();
        const $menu = $(this).next('.dropdown-menu');
        const willOpen = $menu.hasClass('hidden');
        Dropdowns.closeAll();
        $menu.toggleClass('hidden', !willOpen);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
      });

      // click-away + Escape
      $(document).on('click', () => this.closeAll());
      $('.dropdown-menu').on('click', (e) => e.stopPropagation());
      $(document).on('keydown', (e) => {
        if (e.key === 'Escape') this.closeAll();
      });
    },

    closeAll() {
      $('.dropdown-menu').addClass('hidden');
      $('[data-dropdown-trigger]').attr('aria-expanded', 'false');
    }
  };

  /* ============================================================
     MODULE: Sidebar (desktop collapse + mobile drawer)
  ============================================================ */
  const Sidebar = {
    collapsed: false,

    init() {
      $('#sidebarToggle').on('click', () => this.handleToggle());
      $('#sidebarBackdrop').on('click', () => this.closeMobile());
    },

    isMobile() { return window.innerWidth < 1024; },

    handleToggle() {
      if (this.isMobile()) {
        const opening = $('#sidebar').hasClass('-translate-x-full');
        $('#sidebar').toggleClass('-translate-x-full', !opening);
        $('#sidebarBackdrop').toggleClass('hidden', !opening);
        $('#sidebarToggle').attr('aria-expanded', opening ? 'true' : 'false');
      } else {
        this.collapsed = !this.collapsed;
        $('#sidebar').toggleClass('w-64', !this.collapsed).toggleClass('w-[76px]', this.collapsed);
        $('#appMain').toggleClass('lg:ml-64', !this.collapsed).toggleClass('lg:ml-[76px]', this.collapsed);
        $('.nav-label').toggleClass('hidden', this.collapsed);
        $('.nav-item-link').toggleClass('justify-center', this.collapsed);
        $('#sidebarToggle').attr('aria-expanded', this.collapsed ? 'false' : 'true');
        Charts.resizeAll();
      }
    },

    closeMobile() {
      $('#sidebar').addClass('-translate-x-full');
      $('#sidebarBackdrop').addClass('hidden');
      $('#sidebarToggle').attr('aria-expanded', 'false');
    }
  };

  /* ============================================================
     MODULE: Pages — shows one <section class="page-section">,
     keeps sidebar state + heading in sync, and can highlight a
     specific element once the target page is visible.
  ============================================================ */
  const Pages = {
    subtitles: {
      Overview:  "Here's how shoppers are moving through MoodShop today.",
      Analytics: "Deeper look at shopper behaviour and mood trends.",
      Reports:   "Returns awaiting review and generated exports.",
      Settings:  "Manage your admin profile and preferences."
    },

    init() {
      $('.nav-item-link[data-page]').on('click', function (e) {
        e.preventDefault();
        Pages.goTo($(this).data('page'));
        Sidebar.closeMobile();
      });

      // Deep links from notifications, profile menu, etc.
      $(document).on('click', '[data-goto]', function (e) {
        e.preventDefault();
        Pages.goTo($(this).data('goto'), { highlight: $(this).data('highlight') });
      });
    },

    goTo(pageName, opts = {}) {
      if (!pageName) return;
      const $section = $('#page-' + String(pageName).toLowerCase());
      if ($section.length === 0) return;

      $('.nav-item-link[data-page]')
        .removeClass(CLS.navActive).addClass(CLS.navIdle).removeAttr('aria-current');
      $(`.nav-item-link[data-page="${pageName}"]`)
        .removeClass(CLS.navIdle).addClass(CLS.navActive).attr('aria-current', 'page');

      $('#pageTitle').text(pageName);
      $('#pageSubtitle').text(this.subtitles[pageName] || '');

      $('.page-section').addClass('hidden');
      $section.removeClass('hidden');

      Dropdowns.closeAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // canvases in a hidden section measure 0×0, so resize once visible
      Charts.resizeAll();

      if (opts.highlight) this.highlight(opts.highlight);
    },

    highlight(selector) {
      // small delay lets the page-switch animation settle first
      setTimeout(() => {
        const $el = $(selector);
        if ($el.length === 0) return;
        $el[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        $el.addClass('highlight-pulse');
        setTimeout(() => $el.removeClass('highlight-pulse'), 2000);
      }, 200);
    }
  };

  /* ============================================================
     MODULE: Charts
  ============================================================ */
  const Charts = {
    main: null,
    donut: null,
    gauge: null,
    analytics: null,

    datasets: {
      '12m': {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        revenue: [42,45,49,47,53,58,55,61,64,68,72,78],
        users:   [30,33,35,34,38,41,40,44,47,50,54,58]
      },
      '6m': {
        labels: ['Jul','Aug','Sep','Oct','Nov','Dec'],
        revenue: [55,61,64,68,72,78],
        users:   [40,44,47,50,54,58]
      },
      '3m': {
        labels: ['Oct','Nov','Dec'],
        revenue: [68,72,78],
        users:   [50,54,58]
      }
    },

    donutData: {
      labels: ['Happy', 'Celebratory', 'Bored', 'Tired', 'Stressed', 'Romantic'],
      values: [28, 22, 18, 14, 10, 8],
      colors: ['#d9a130', '#c2664f', '#6c5cb0', '#3d6d94', '#4c8268', '#c65d7b']
    },

    analyticsData: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],
      happy:       [20,22,24,23,25,27,28,29,28],
      stressed:    [16,15,14,13,12,11,11,10,10],
      celebratory: [14,15,16,17,18,19,20,21,22]
    },

    themeColors() {
      const dark = $('html').attr('data-theme') === 'dark';
      return {
        grid:   dark ? 'rgba(255,255,255,.07)' : 'rgba(36,30,78,.06)',
        tick:   dark ? '#a6a1bd' : '#6f6b7c',
        cardBg: dark ? '#1d1938' : '#ffffff',
        border: dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'
      };
    },

    baseFont: { family: 'Manrope', size: 11.5 },

    init() {
      this.renderMain('12m');
      this.renderDonut();
      this.renderGauge();
      this.renderAnalytics();

      $('[data-range]').on('click', function () {
        $('[data-range]')
          .removeClass(CLS.rangeActive).addClass(CLS.rangeIdle).attr('aria-pressed', 'false');
        $(this)
          .removeClass(CLS.rangeIdle).addClass(CLS.rangeActive).attr('aria-pressed', 'true');
        Charts.renderMain($(this).data('range'));
      });
    },

    renderMain(range) {
      const c = this.themeColors();
      const d = this.datasets[range];
      const canvas = document.getElementById('mainChart');
      if (!canvas || !d) return;

      if (this.main) this.main.destroy();

      this.main = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: d.labels,
          datasets: [
            {
              label: 'Sales (Rs, 000s)', data: d.revenue, backgroundColor: '#6c5cb0',
              borderRadius: 6, maxBarThickness: 22, categoryPercentage: 0.6, barPercentage: 0.9
            },
            {
              label: 'Active Shoppers (k)', data: d.users, backgroundColor: '#c2664f',
              borderRadius: 6, maxBarThickness: 22, categoryPercentage: 0.6, barPercentage: 0.9
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              position: 'top', align: 'end',
              labels: { color: c.tick, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { family: 'Manrope', size: 12, weight: 600 } }
            },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: c.border, borderWidth: 1, padding: 10,
              titleFont: { family: 'Manrope', weight: 700 }, bodyFont: { family: 'Manrope' }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: c.tick, font: this.baseFont } },
            y: { grid: { color: c.grid }, ticks: { color: c.tick, font: this.baseFont } }
          }
        }
      });
    },

    renderDonut() {
      const c = this.themeColors();
      const canvas = document.getElementById('donutChart');
      if (!canvas) return;
      if (this.donut) this.donut.destroy();

      const topIndex = this.donutData.values.indexOf(Math.max(...this.donutData.values));
      const centerTextPlugin = {
        id: 'donutCenterText',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, top, bottom } } = chart;
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = c.tick;
          ctx.font = '700 12px Manrope';
          ctx.fillText(Charts.donutData.labels[topIndex], cx, cy - 12);
          ctx.fillStyle = Charts.donutData.colors[topIndex];
          ctx.font = '800 22px Manrope';
          ctx.fillText(Charts.donutData.values[topIndex] + '%', cx, cy + 10);
          ctx.restore();
        }
      };

      this.donut = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: this.donutData.labels,
          datasets: [{
            data: this.donutData.values,
            backgroundColor: this.donutData.colors,
            borderWidth: 3,
            borderColor: c.cardBg,
            hoverOffset: 6
          }]
        },
        plugins: [centerTextPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: c.border, borderWidth: 1, padding: 10
            }
          }
        }
      });

      const $legend = $('#donutLegend').empty();
      this.donutData.labels.forEach((label, i) => {
        $legend.append(`
          <li class="text-[12.5px] text-ink-600">
            <span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style="background:${this.donutData.colors[i]};"></span>${label}
            <strong class="num-tabular text-ink-900">${this.donutData.values[i]}%</strong>
          </li>
        `);
      });
    },

    renderGauge() {
      const c = this.themeColors();
      const canvas = document.getElementById('moodGaugeChart');
      if (!canvas) return;
      if (this.gauge) this.gauge.destroy();

      const value = 34.2;
      const gaugeCenterPlugin = {
        id: 'gaugeCenterText',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, bottom } } = chart;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#6c5cb0';
          ctx.font = '800 20px Manrope';
          ctx.fillText(value + '%', (left + right) / 2, bottom - 2);
          ctx.restore();
        }
      };

      this.gauge = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { datasets: [{ data: [value, 100 - value], backgroundColor: ['#6c5cb0', c.grid], borderWidth: 0 }] },
        plugins: [gaugeCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          circumference: 180,
          rotation: 270,
          cutout: '75%',
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    },

    renderAnalytics() {
      const c = this.themeColors();
      const canvas = document.getElementById('analyticsChart');
      if (!canvas) return;
      if (this.analytics) this.analytics.destroy();

      const d = this.analyticsData;
      this.analytics = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: d.labels,
          datasets: [
            { label: 'Happy',       data: d.happy,       borderColor: '#d9a130', backgroundColor: '#d9a130', tension: .35, pointRadius: 2 },
            { label: 'Stressed',    data: d.stressed,    borderColor: '#4c8268', backgroundColor: '#4c8268', tension: .35, pointRadius: 2 },
            { label: 'Celebratory', data: d.celebratory, borderColor: '#c2664f', backgroundColor: '#c2664f', tension: .35, pointRadius: 2 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              position: 'top', align: 'end',
              labels: { color: c.tick, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { family: 'Manrope', size: 12, weight: 600 } }
            },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: c.border, borderWidth: 1, padding: 10
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: c.tick, font: this.baseFont } },
            y: { grid: { color: c.grid }, ticks: { color: c.tick, font: this.baseFont } }
          }
        }
      });
    },

    each(fn) {
      ['main', 'donut', 'gauge', 'analytics'].forEach(k => { if (this[k]) fn(this[k]); });
    },

    // re-measure visible canvases after a layout change (sidebar, page swap)
    resizeAll() {
      setTimeout(() => this.each(chart => chart.resize()), 240);
    },

    // rebuild every chart with the current theme's colors
    refreshColors() {
      const activeRange = $('[data-range][aria-pressed="true"]').data('range') || '12m';
      this.renderMain(activeRange);
      this.renderDonut();
      this.renderGauge();
      this.renderAnalytics();
    },

    // destroy everything — prevents canvas/listener leaks on teardown
    destroyAll() {
      this.each(chart => chart.destroy());
      this.main = this.donut = this.gauge = this.analytics = null;
    }
  };

  /* ============================================================
     MODULE: Orders Table (render, search, paginate)
  ============================================================ */
  const TxTable = {
    rowsPerPage: 5,
    currentPage: 1,
    filtered: [],

    moodColors: {
      Happy: '#d9a130', Celebratory: '#c2664f', Bored: '#6c5cb0',
      Tired: '#3d6d94', Stressed: '#4c8268', Romantic: '#c65d7b'
    },
    moodSoft: {
      Happy: 'var(--mood-happy-soft)', Celebratory: 'var(--mood-celebratory-soft)', Bored: 'var(--mood-bored-soft)',
      Tired: 'var(--mood-tired-soft)', Stressed: 'var(--mood-stressed-soft)', Romantic: 'var(--mood-romantic-soft)'
    },
    statusPill: {
      completed: 'bg-mood-stressed-soft text-mood-stressed',
      pending:   'bg-mood-happy-soft text-mood-happy',
      failed:    'bg-danger-soft text-danger'
    },

    data: [
      { name: 'Sarah Malik',    initials: 'SM', id: 'ORD-84021', date: 'Sep 10, 2026', mood: 'Happy',       amount: 'Rs 12,400', status: 'completed' },
      { name: 'Hamza Tariq',    initials: 'HT', id: 'ORD-84020', date: 'Sep 10, 2026', mood: 'Stressed',    amount: 'Rs 3,895',  status: 'pending' },
      { name: 'Areej Nadeem',  initials: 'AN', id: 'ORD-84019', date: 'Sep 09, 2026', mood: 'Celebratory', amount: 'Rs 20,150', status: 'completed' },
      { name: 'M. Ammar',       initials: 'MA', id: 'ORD-84018', date: 'Sep 09, 2026', mood: 'Bored',       amount: 'Rs 762',    status: 'failed' },
      { name: 'Fatima Zahra',   initials: 'FZ', id: 'ORD-84017', date: 'Sep 08, 2026', mood: 'Romantic',    amount: 'Rs 5,400',  status: 'completed' },
      { name: 'Usman Ghani',    initials: 'UG', id: 'ORD-84016', date: 'Sep 08, 2026', mood: 'Tired',       amount: 'Rs 18,908', status: 'pending' },
      { name: 'Mahnoor Sheikh', initials: 'MS', id: 'ORD-84015', date: 'Sep 07, 2026', mood: 'Happy',       amount: 'Rs 3,124',  status: 'completed' },
      { name: 'Ali Raza',       initials: 'AR', id: 'ORD-84014', date: 'Sep 07, 2026', mood: 'Bored',       amount: 'Rs 950',    status: 'failed' },
      { name: 'Zainab Farooq',  initials: 'ZF', id: 'ORD-84013', date: 'Sep 06, 2026', mood: 'Celebratory', amount: 'Rs 41,200', status: 'completed' },
      { name: 'Danish Iqbal',   initials: 'DI', id: 'ORD-84012', date: 'Sep 06, 2026', mood: 'Stressed',    amount: 'Rs 2,100',  status: 'pending' },
      { name: 'Noor ul Ain',    initials: 'NA', id: 'ORD-84011', date: 'Sep 05, 2026', mood: 'Romantic',    amount: 'Rs 6,753',  status: 'completed' },
      { name: 'Kamran Yousuf',  initials: 'KY', id: 'ORD-84010', date: 'Sep 05, 2026', mood: 'Tired',       amount: 'Rs 589',    status: 'failed' }
    ],

    cellBase: 'border-b border-line px-3 py-3.5 align-middle',

    init() {
      this.filtered = this.data;
      this.render();

    $('#tableSearchInput, #globalSearchInput').on('input', function () {
  const term = $(this).val();
  $('#tableSearchInput, #globalSearchInput').not(this).val(term);
  TxTable.handleSearch(term);

  // Search karte hi auto-scroll to table
  if (this.id === 'globalSearchInput' && term.trim() !== '') {
    const tableContainer = document.getElementById('txTableBody')?.closest('.bg-card') || document.getElementById('txTableBody');
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});
      $('#paginationControls').on('click', '[data-page-nav]', function () {
        TxTable.navigate($(this).data('page-nav'));
      });
    },

    handleSearch(term) {
      const q = String(term).trim().toLowerCase();
      this.filtered = !q ? this.data : this.data.filter(row =>
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.mood.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
      this.currentPage = 1;
      this.render();
    },

    navigate(action) {
      const totalPages = this.totalPages();
      if (action === 'prev' && this.currentPage > 1) this.currentPage--;
      if (action === 'next' && this.currentPage < totalPages) this.currentPage++;
      if (typeof action === 'number') this.currentPage = action;
      this.render();
    },

    totalPages() { return Math.max(1, Math.ceil(this.filtered.length / this.rowsPerPage)); },

    render() {
      const start = (this.currentPage - 1) * this.rowsPerPage;
      const pageRows = this.filtered.slice(start, start + this.rowsPerPage);
      const $body = $('#txTableBody').empty();

      if (pageRows.length === 0) {
        $body.append(`<tr><td colspan="6" class="px-3 py-6 text-center text-ink-400">No orders match your search. Clear the filter to see all orders.</td></tr>`);
      } else {
        pageRows.forEach(row => {
          $body.append(`
            <tr id="order-${row.id}" class="transition-colors duration-150 hover:bg-surface">
              <td class="${this.cellBase}">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-bold text-white" aria-hidden="true">${row.initials}</span>
                  <span class="font-semibold">${row.name}</span>
                </div>
              </td>
              <td class="${this.cellBase} num-tabular text-ink-600">${row.id}</td>
              <td class="${this.cellBase} text-ink-600">${row.date}</td>
              <td class="${this.cellBase}">
                <span class="inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold" style="background:${this.moodSoft[row.mood]}; color:${this.moodColors[row.mood]};">${row.mood}</span>
              </td>
              <td class="${this.cellBase} num-tabular font-bold">${row.amount}</td>
              <td class="${this.cellBase}">
                <span class="inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold ${this.statusPill[row.status]}">${this.capitalize(row.status)}</span>
              </td>
            </tr>
          `);
        });
      }
      this.renderPagination();
    },

    renderPagination() {
      const total = this.filtered.length;
      const totalPages = this.totalPages();
      const start = total === 0 ? 0 : (this.currentPage - 1) * this.rowsPerPage + 1;
      const end = Math.min(this.currentPage * this.rowsPerPage, total);

      $('#paginationInfo').text(`Showing ${start}–${end} of ${total}`);

      const btn = 'flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[13px] font-bold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mood-bored disabled:opacity-40';
      const $controls = $('#paginationControls').empty();

      $controls.append(`<button type="button" class="${btn} ${CLS.pageIdle}" data-page-nav="prev" aria-label="Previous page" ${this.currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left" aria-hidden="true"></i></button>`);
      for (let i = 1; i <= totalPages; i++) {
        const state = i === this.currentPage ? CLS.pageActive : CLS.pageIdle;
        $controls.append(`<button type="button" class="${btn} ${state}" data-page-nav="${i}" aria-label="Page ${i}" ${i === this.currentPage ? 'aria-current="page"' : ''}>${i}</button>`);
      }
      $controls.append(`<button type="button" class="${btn} ${CLS.pageIdle}" data-page-nav="next" aria-label="Next page" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`);
    },

    capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  };

  /* ============================================================
     MODULE: Settings page (static save feedback)
  ============================================================ */
  const Settings = {
    init() {
      $('#saveSettingsBtn').on('click', function () {
        const $btn = $(this);
        if ($btn.data('busy')) return;
        const original = $btn.html();
        $btn.data('busy', true).html('<i class="bi bi-check2" aria-hidden="true"></i>Saved');
        setTimeout(() => $btn.html(original).data('busy', false), 1400);
      });
    }
  };

  /* ============================================================
     INIT
  ============================================================ */
  Theme.init();
  Dropdowns.init();
  Sidebar.init();
  Pages.init();
  Charts.init();
  TxTable.init();
  Settings.init();

  // Keep charts sized to their wrappers and reset the mobile drawer
  $(window).on('resize', debounce(function () {
    if (window.innerWidth >= 1024) {
      $('#sidebar').removeClass('-translate-x-full');
      $('#sidebarBackdrop').addClass('hidden');
    } else {
      $('#sidebar').addClass('-translate-x-full');
    }
    Charts.each(chart => chart.resize());
  }, 150));

  // Tear charts down on unload so no canvas contexts or listeners leak
  $(window).on('pagehide', () => Charts.destroyAll());
});
