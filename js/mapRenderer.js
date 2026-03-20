/**
 * mapRenderer.js — Canvas-based hex map drawing.
 *
 * Provides the MapRenderer constructor used as window.cryptid.map.
 * Handles tile drawing, structure overlay, target highlight, responsive
 * canvas sizing, and map collapse/expand (docked vs. panel mode).
 *
 * Depends on: jQuery, mapData.js (TILE_IMAGES, STRUCT_IMAGES, HEX_CONFIG)
 *
 * @param {string} canvasId - ID of the <canvas> element.
 * @param {string} mapKey   - Encoded map key string (tiles + structures).
 * @param {boolean} advanced - Whether advanced (all 8 structures) mode is active.
 * @param {string} size     - Initial breakpoint key: 'mobile' | 'tablet' | 'desktop'.
 */
function MapRenderer(canvasId, mapKey, advanced, size) {
  let tileImages;      // Array of loaded HTMLImageElement for tiles
  let structImages;    // Array of arrays of loaded HTMLImageElement for structures
  let currentSize;     // Current breakpoint key
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  let mapKeyValue = mapKey;
  let isAdvanced = advanced;
  let targetVisible = false;

  // ---------------------------------------------------------------------------
  // Internal: map new settings
  // ---------------------------------------------------------------------------

  /**
   * Apply new map settings and trigger a redraw.
   * @param {string} key      - New map key.
   * @param {boolean} adv     - Advanced mode flag.
   * @param {Object} target   - Target coordinate string "col,row" or null.
   */
  this.newMapSettings = function (key, adv, target) {
    mapKeyValue = key;
    isAdvanced = adv;
    targetVisible = false;
    this.loadAndDraw();
  };

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  this.imageOnload = function (img) {
    tileImages.push(img);
    if (imagesLoaded()) {
      tileImages.sort();
    }
  };

  /**
   * Load all images for the current size and draw once complete.
   * If images are already loaded (array lengths match expected counts),
   * skip loading and draw immediately.
   */
  this.loadAndDraw = function () {
    const tiles = TILE_IMAGES[currentSize];
    const structs = STRUCT_IMAGES[currentSize];
    const totalExpected = tiles.length + structs[0].length + structs[1].length;

    if (totalExpected !== tiles.length) {
      // Need to (re)load images
      const self = this;
      let remaining = totalExpected;
      tileImages = [];
      structImages = [];

      tiles.forEach(function (src) {
        const img = new Image();
        img.onload = function () {
          if (--remaining <= 0) self.drawList();
        };
        img.src = src;
        tileImages.push(img);
      });

      structs.forEach(function (group, groupIdx) {
        structImages[groupIdx] = [];
        group.forEach(function (src) {
          const img = new Image();
          img.onload = function () {
            if (--remaining <= 0) self.drawList();
          };
          img.src = src;
          structImages[groupIdx].push(img);
        });
      });
    } else {
      this.drawList();
    }
  };

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /** Draw map tiles, structures, and (if set) the target highlight. */
  this.drawList = function () {
    this.drawMap();
    this.drawStructures();
    if (targetVisible) {
      this.drawTarget(this.pTargetX, this.pTargetY);
    }
  };

  /**
   * Draw a single tile image at board position (col, row).
   * @param {number} col - 1-indexed column.
   * @param {number} row - 1-indexed row.
   * @param {HTMLImageElement} img - Tile image to draw.
   */
  this.drawTile = function (col, row, img) {
    let y = this.yPosToPx(row);
    const x = this.xPosToPx(col);
    if (col % 2 === 0) {
      y += HEX_CONFIG[currentSize].hex_h / 2;
    }
    if (img.naturalWidth === 0) {
      img.onload = function () {
        ctx.drawImage(img, x, y);
      };
    } else {
      ctx.drawImage(img, x, y);
    }
  };

  /**
   * Draw a structure image centred on board position (col, row).
   * @param {number} col - 1-indexed column.
   * @param {number} row - 1-indexed row.
   * @param {HTMLImageElement} img - Structure image.
   */
  this.drawStructure = function (col, row, img) {
    let y = this.yPosToPx(row);
    let x = this.xPosToPx(col);
    if (col % 2 === 0) {
      y += HEX_CONFIG[currentSize].hex_h / 2;
    }
    const cfg = HEX_CONFIG[currentSize];
    if (img.naturalWidth === 0) {
      img.onload = function () {
        x += (cfg.hex_d - img.naturalWidth) / 2;
        y += (cfg.hex_h - img.naturalHeight) / 2;
        ctx.drawImage(img, x, y);
      };
    } else {
      x += (cfg.hex_d - img.naturalWidth) / 2;
      y += (cfg.hex_h - img.naturalHeight) / 2;
      ctx.drawImage(img, x, y);
    }
  };

  /**
   * Draw the tile-number label for a given board position.
   * @param {number} tilePos - 0-indexed tile position (0–5, left-right top-bottom).
   * @param {number} tileDesignIdx - 0-indexed tile design index (0–11).
   */
  this.drawText = function (tilePos, tileDesignIdx) {
    const cfg = HEX_CONFIG[currentSize];
    let x = cfg.numberMargin / 2;
    if (tilePos % 2 !== 1) {
      x += 6 * cfg.hex_d + 6.5 * cfg.hex_s + cfg.numberMargin + cfg.tileGap;
    }
    const tileRow = 1 + Math.floor((tilePos - 1) / 2);
    const y = (3 * cfg.hex_h + cfg.tileGap) * (tileRow - 1) + 2 * cfg.hex_h;
    ctx.font = 'bold ' + cfg.numberFontSize + ' "Alegreya"';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    const label = (tileDesignIdx % 6) + 1;
    ctx.fillText(label, x, y, cfg.numberMargin);
  };

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert 1-indexed column to canvas x pixel.
   * @param {number} col
   * @returns {number}
   */
  this.xPosToPx = function (col) {
    const cfg = HEX_CONFIG[currentSize];
    return cfg.numberMargin + (col > 6 ? cfg.tileGap : 0) + (col - 1) * cfg.hex_ds;
  };

  /**
   * Convert 1-indexed row to canvas y pixel.
   * @param {number} row
   * @returns {number}
   */
  this.yPosToPx = function (row) {
    const cfg = HEX_CONFIG[currentSize];
    return Math.floor((row - 1) / 3) * cfg.tileGap + (row - 1) * cfg.hex_h;
  };

  // ---------------------------------------------------------------------------
  // Map and structure drawing
  // ---------------------------------------------------------------------------

  /** Clear the canvas and draw all six map tiles with orientation dots and labels. */
  this.drawMap = function () {
    const cfg = HEX_CONFIG[currentSize];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const key = mapKeyValue.replace('intro_', '');

    for (let pos = 0; pos < 6; pos++) {
      const char = key.substring(pos, pos + 1);
      const designIdx = parseInt(char, 16) - 1;
      const col = (pos % 2) * 6 + 1;
      const row = 3 * Math.floor(pos / 2) + 1;
      this.drawTile(col, row, tileImages[designIdx]);

      // Orientation dot: for rotated tiles (7–12) the dot is at bottom-right
      const dotPos = designIdx > 5
        ? { x: col + 5, y: row + 2 }
        : { x: col, y: row };
      let dotY = this.yPosToPx(dotPos.y);
      const dotX = this.xPosToPx(dotPos.x);
      if (dotPos.x % 2 === 0) {
        dotY += cfg.hex_h / 2;
      }

      ctx.fillStyle = cfg.dot_color;
      ctx.beginPath();
      ctx.arc(
        dotX + cfg.hex_d / 2,
        dotY + cfg.hex_h / 2,
        cfg.dot_height / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.stroke();

      this.drawText(pos + 1, designIdx);
    }
  };

  /** Draw structure images at positions encoded in the map key. */
  this.drawStructures = function () {
    const structs = structImages;
    let charOffset = 6; // First 6 chars of key are tiles; structures follow
    const self = this;
    const key = mapKeyValue.replace('intro_', '');

    structs.forEach(function (group, groupIdx) {
      group.forEach(function (img, imgIdx) {
        if (isAdvanced && imgIdx < 3 || !isAdvanced) {
          const col = parseInt(key.substring(charOffset, charOffset + 1), 16) + 1;
          const row = parseInt(key.substring(charOffset + 1, charOffset + 2), 16) + 1;
          charOffset += 2;
          self.drawStructure(row, col, img);
        }
      });
    });
  };

  /**
   * Draw the target (habitat) highlight.  Greys out all other hexes using
   * the mask image, then draws the target image on the selected hex.
   * @param {number} col - 1-indexed column of target.
   * @param {number} row - 1-indexed row of target.
   */
  this.drawTarget = function (col, row) {
    targetVisible = true;
    this.pTargetX = col;
    this.pTargetY = row;
    const maskImg = tileImages[tileImages.length - 2];

    for (let c = 1; c <= 12; c++) {
      for (let r = 1; r <= 9; r++) {
        if (c !== col || r !== row) {
          this.drawTile(c, r, maskImg);
        }
      }
    }

    const targetImg = tileImages[tileImages.length - 1];
    this.drawTile(col, row, targetImg);
  };

  // ---------------------------------------------------------------------------
  // Responsive sizing
  // ---------------------------------------------------------------------------

  /**
   * Switch the canvas to a different breakpoint size.
   * @param {string} newSize - 'mobile' | 'tablet' | 'desktop'
   */
  this.setWidth = function (newSize) {
    if (newSize !== currentSize && newSize in HEX_CONFIG) {
      currentSize = newSize;
      tileImages = [];
      canvas.width = HEX_CONFIG[currentSize].canvas_width;
      canvas.height = HEX_CONFIG[currentSize].canvas_height;
    }
  };

  /**
   * Automatically choose the appropriate breakpoint size based on window
   * width and docked/expanded state, then redraw.
   */
  this.autoWidthAdjust = function () {
    let chosen;
    const windowWidth = $(window).width();
    const isDocked = this.isDocked();
    const thresholds = HEX_CONFIG.thresholds;

    for (const key in thresholds) {
      if (windowWidth >= thresholds[key]) {
        chosen = key;
      }
    }

    if (isDocked === true) {
      if (this.dockable()) {
        chosen = 'mobile';
      } else {
        this.expandMap();
      }
    }

    if (currentSize !== chosen) {
      this.setWidth(chosen);
      this.loadAndDraw();
    }
  };

  // ---------------------------------------------------------------------------
  // Map expand/collapse
  // ---------------------------------------------------------------------------

  /** Collapse the map panel or dock it to the sidebar. */
  this.collapseMap = function () {
    const menuWidth = $('#menuLarge').width();
    const self = this;
    const shouldSlide = HEX_CONFIG.mobile.canvas_width > menuWidth;
    if (shouldSlide) {
      $('#mapCanvas').slideUp('slow', function () {
        self.autoSetMapArrow();
      });
    } else if (this.isDocked()) {
      $('#mapDiv').detach().prependTo('#gameMapAnchor');
      self.autoWidthAdjust();
    } else {
      $('#mapDiv').detach().appendTo('#mapAnchor');
      self.autoWidthAdjust();
      if (!$('#mapCanvas').is(':visible')) {
        $('#mapCanvas').slideDown('slow', function () {
          self.autoSetMapArrow();
        });
      }
    }
  };

  /** Expand the map panel. */
  this.expandMap = function () {
    $('#mapDiv').show();
    const self = this;
    if (this.isDocked()) {
      $('#mapDiv').detach().prependTo('#gameMapAnchor');
      this.autoWidthAdjust();
    } else if (this.isCollapsed()) {
      $('#mapCanvas').slideDown('slow', function () {
        self.autoSetMapArrow();
      });
    }
  };

  /** Toggle collapse/expand state. */
  this.toggleExpand = function () {
    if (this.isCollapsed() || this.isDocked()) {
      this.expandMap();
      this.autoSetMapArrow();
    } else {
      this.collapseMap();
      this.autoSetMapArrow();
    }
  };

  /** @returns {boolean} True when the map canvas is hidden (collapsed). */
  this.isCollapsed = function () {
    return !$('#mapCanvas').is(':visible');
  };

  /** @returns {boolean} True when the map is docked in the sidebar anchor. */
  this.isDocked = function () {
    return $('#mapAnchor > #mapDiv').length > 0;
  };

  /** @returns {boolean} True when the sidebar is wide enough to dock the map. */
  this.dockable = function () {
    return !(HEX_CONFIG.mobile.canvas_width > $('#menuLarge').width());
  };

  /**
   * Set the collapse arrow text explicitly.
   * @param {string} text - Arrow text (e.g. '[–]', '[+]', '[<]', '[>]').
   */
  this.setMapArrow = function (text) {
    $('#mapCollapseArrow').text(text);
  };

  /** Automatically choose the correct arrow text based on current state. */
  this.autoSetMapArrow = function () {
    const docked = this.isDocked();
    const collapsed = this.isCollapsed();
    const notDockable = !this.dockable();

    if (docked) {
      this.setMapArrow('[>]');
    } else if (notDockable) {
      this.setMapArrow(collapsed ? '[+]' : '[-]');
    } else {
      this.setMapArrow(collapsed ? '[+]' : '[<]');
    }
  };

  // ---------------------------------------------------------------------------
  // Initialise size
  // ---------------------------------------------------------------------------
  currentSize = size || 'mobile';
  tileImages = [];
  structImages = [];
  canvas.width = HEX_CONFIG[currentSize].canvas_width;
  canvas.height = HEX_CONFIG[currentSize].canvas_height;
}
