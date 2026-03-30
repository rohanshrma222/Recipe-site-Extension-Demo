(async function () {
  if (window.__offSmartKitchenInitialized) {
    return;
  }
  window.__offSmartKitchenInitialized = true;

  var PANEL_HOST_ID = "off-smart-kitchen";
  var PANEL_WIDTH = 320;
  var STYLE_URL = chrome.runtime.getURL("styles.css");

  function createElement(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (typeof text === "string") {
      el.textContent = text;
    }
    return el;
  }+

  function truncateWhitespace(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function extractIngredients() {
    var selectors = [
      ".ingredient li",
      ".ingredients li",
      "[class*='ingredient'] li",
      "section[class*='ingredient'] li",
      "div[class*='ingredient'] li"
    ];
    var seen = new Set();
    var items = [];

    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        var text = truncateWhitespace(node.textContent);
        if (text && !seen.has(text)) {
          seen.add(text);
          items.push(text);
        }
      });
    });

    return items;
  }

  function normalizeIngredient(raw) {
    if (!raw) {
      return "";
    }

    var text = raw.toLowerCase();
    text = text.replace(/\([^)]*\)/g, " ");
    text = text.split(",")[0];
    text = text.replace(/[\u2013\u2014-]/g, " ");

    var numberWords = [
      "a",
      "an",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "half",
      "quarter"
    ];
    var units = [
      "cup",
      "cups",
      "tbsp",
      "tablespoon",
      "tablespoons",
      "tsp",
      "teaspoon",
      "teaspoons",
      "ml",
      "millilitre",
      "millilitres",
      "milliliter",
      "milliliters",
      "l",
      "litre",
      "litres",
      "liter",
      "liters",
      "g",
      "gram",
      "grams",
      "kg",
      "kilogram",
      "kilograms",
      "lb",
      "lbs",
      "pound",
      "pounds",
      "oz",
      "ounce",
      "ounces",
      "pinch",
      "pinches",
      "handful",
      "handfuls",
      "clove",
      "cloves",
      "slice",
      "slices",
      "can",
      "cans",
      "package",
      "packages",
      "pkg",
      "pkgs"
    ];

    var quantityPattern = new RegExp(
      "^\\s*(?:(?:\\d+[\\d\\s./-]*)|(?:[\\u00BC\\u00BD\\u00BE\\u2153\\u2154\\u215B\\u215C\\u215D\\u215E])|(?:" +
        numberWords.join("|") +
        "))\\b\\s*",
      "i"
    );
    text = text.replace(quantityPattern, "");

    var unitPattern = new RegExp("^\\s*(?:" + units.join("|") + ")\\b\\s*", "i");
    var safety = 0;
    while (unitPattern.test(text) && safety < 5) {
      text = text.replace(unitPattern, "");
      safety += 1;
    }

    text = text.replace(quantityPattern, "");
    text = text.replace(/^\s*of\b\s*/i, "");
    text = text.replace(/^\s+|\s+$/g, "");
    text = text.replace(/\s+/g, " ");
    return text;
  }

  function getNutriScoreData(grade) {
    var normalized = typeof grade === "string" ? grade.toLowerCase() : "";
    var map = {
      a: { label: "A", color: "#1f9d55" },
      b: { label: "B", color: "#7ccf5c" },
      c: { label: "C", color: "#d4b21f" },
      d: { label: "D", color: "#d97706" },
      e: { label: "E", color: "#d64545" }
    };
    return map[normalized] || { label: "N/A", color: "#8b8b8b" };
  }

  function getNovaData(group) {
    var value = String(group || "?");
    var map = {
      "1": "#1f9d55",
      "2": "#d4b21f",
      "3": "#d97706",
      "4": "#d64545",
      "?": "#8b8b8b"
    };
    return { label: "NOVA " + value, color: map[value] || "#8b8b8b" };
  }

  function getProductName(product) {
    return (
      truncateWhitespace(product.product_name_en) ||
      truncateWhitespace(product.product_name) ||
      truncateWhitespace(product.abbreviated_product_name) ||
      "Unknown product"
    );
  }

  function getBarcode(product) {
    return truncateWhitespace(product.code) || truncateWhitespace(product._id);
  }

  function buildSearchUrl(term) {
    var url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", term);
    url.searchParams.set("tagtype_0", "countries");
    url.searchParams.set("tag_contains_0", "contains");
    url.searchParams.set("tag_0", "canada");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "3");
    return url.toString();
  }

  async function fetchProductsForIngredient(rawIngredient) {
    var normalized = normalizeIngredient(rawIngredient);
    if (!normalized) {
      return { raw: rawIngredient, normalized: normalized, products: [], error: false };
    }

    try {
      var response = await fetch(buildSearchUrl(normalized));
      if (!response.ok) {
        throw new Error("Search failed with status " + response.status);
      }
      var data = await response.json();
      return {
        raw: rawIngredient,
        normalized: normalized,
        products: Array.isArray(data.products) ? data.products.slice(0, 3) : [],
        error: false
      };
    } catch (error) {
      return { raw: rawIngredient, normalized: normalized, products: [], error: true };
    }
  }

  function renderProductCard(product) {
    var card = createElement("div", "off-card");
    var title = createElement("div", "off-card-title", getProductName(product));
    var meta = createElement("div", "off-badges");

    var nutri = getNutriScoreData(product.nutriscore_grade);
    var nutriBadge = createElement("span", "off-badge", "Nutri-Score " + nutri.label);
    nutriBadge.style.backgroundColor = nutri.color;

    var nova = getNovaData(product.nova_group);
    var novaBadge = createElement("span", "off-badge", nova.label);
    novaBadge.style.backgroundColor = nova.color;

    meta.appendChild(nutriBadge);
    meta.appendChild(novaBadge);

    card.appendChild(title);
    card.appendChild(meta);

    var barcode = getBarcode(product);
    if (barcode) {
      var link = createElement("a", "off-link", "View on Open Food Facts \u2197");
      link.href = "https://ca.openfoodfacts.org/product/" + encodeURIComponent(barcode) + "/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.appendChild(link);
    }

    return card;
  }

  function setExpanded(section, expanded) {
    var content = section.querySelector(".off-section-content");
    var chevron = section.querySelector(".off-chevron");
    section.setAttribute("data-expanded", expanded ? "true" : "false");
    if (content) {
      content.hidden = !expanded;
    }
    if (chevron) {
      chevron.textContent = expanded ? "\u25BE" : "\u25B8";
    }
  }

  function renderResults(container, results) {
    container.textContent = "";

    if (!results.length) {
      container.appendChild(createElement("div", "off-empty", "No ingredients found on this page."));
      return;
    }

    results.forEach(function (result) {
      var section = createElement("section", "off-section");
      section.setAttribute("data-expanded", "false");

      var button = createElement("button", "off-section-toggle");
      button.type = "button";

      var titleWrap = createElement("div", "off-section-title-wrap");
      var ingredientName = createElement("div", "off-section-title", result.raw);
      var normalizedName = createElement(
        "div",
        "off-section-subtitle",
        result.normalized ? "Search: " + result.normalized : "Search unavailable"
      );
      titleWrap.appendChild(ingredientName);
      titleWrap.appendChild(normalizedName);

      var chevron = createElement("span", "off-chevron", "\u25B8");
      button.appendChild(titleWrap);
      button.appendChild(chevron);

      var content = createElement("div", "off-section-content");
      content.hidden = true;

      if (result.products.length) {
        result.products.forEach(function (product) {
          content.appendChild(renderProductCard(product));
        });
      } else {
        content.appendChild(
          createElement(
            "div",
            "off-empty",
            result.error ? "No products found" : "No products found"
          )
        );
      }

      button.addEventListener("click", function () {
        var expanded = section.getAttribute("data-expanded") === "true";
        setExpanded(section, !expanded);
      });

      section.appendChild(button);
      section.appendChild(content);
      container.appendChild(section);
    });
  }

  async function loadStyles(shadowRoot) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_URL;

    return new Promise(function (resolve) {
      link.addEventListener("load", function () {
        resolve();
      });
      link.addEventListener("error", function () {
        var fallback = document.createElement("style");
        fallback.textContent = ".off-error{padding:12px;color:#b91c1c;font:14px/1.4 Arial,sans-serif;}";
        shadowRoot.appendChild(fallback);
        resolve();
      });
      shadowRoot.appendChild(link);
    });
  }

  async function init() {
    var existingHost = document.getElementById(PANEL_HOST_ID);
    if (existingHost) {
      return;
    }

    var ingredients = extractIngredients();
    var host = document.createElement("div");
    host.id = PANEL_HOST_ID;
    document.body.appendChild(host);

    var shadowRoot = host.attachShadow({ mode: "open" });
    await loadStyles(shadowRoot);

    var wrapper = createElement("div", "off-root");
    var panel = createElement("aside", "off-panel off-open");
    panel.setAttribute("aria-label", "Smart Kitchen Assistant");

    var header = createElement("div", "off-header");
    header.textContent = "Smart Kitchen Assistant";

    var body = createElement("div", "off-body");
    var loading = createElement("div", "off-loading");
    var spinner = createElement("div", "off-spinner");
    spinner.setAttribute("aria-hidden", "true");
    loading.appendChild(spinner);
    loading.appendChild(createElement("div", "off-loading-text", "Loading products..."));

    body.appendChild(loading);
    panel.appendChild(header);
    panel.appendChild(body);

    var toggle = createElement("button", "off-tab-toggle", "Kitchen Assistant");
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Toggle Smart Kitchen Assistant");

    toggle.addEventListener("click", function () {
      var isOpen = panel.classList.contains("off-open");
      panel.classList.toggle("off-open", !isOpen);
      panel.classList.toggle("off-closed", isOpen);
      toggle.classList.toggle("off-open", !isOpen);
      toggle.classList.toggle("off-closed", isOpen);
    });

    toggle.classList.add("off-open");
    wrapper.appendChild(panel);
    wrapper.appendChild(toggle);
    shadowRoot.appendChild(wrapper);

    var results = await Promise.all(ingredients.map(fetchProductsForIngredient));
    renderResults(body, results);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
