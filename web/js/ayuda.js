(function () {
  "use strict";

  const state = {
    categories: [],
    lastQuery: ""
  };

  const refs = {
    search: document.getElementById("helpSearch"),
    categories: document.getElementById("categoryGrid"),
    results: document.getElementById("searchResults"),
    statsArticles: document.getElementById("statsArticles")
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const countArticles = (categories = []) =>
    categories.reduce((total, cat) => total + (cat.articles?.length || 0), 0);

  const toggleArticle = (item) => {
    const isOpen = item.classList.contains("is-open");
    item.classList.toggle("is-open", !isOpen);
  };

  const createArticleItem = (article) => {
    const li = document.createElement("li");
    li.className = "article-item";
    const title = document.createElement("p");
    title.className = "article-item__title";
    title.textContent = article.title;
    const summary = document.createElement("p");
    summary.className = "article-item__summary";
    summary.textContent = article.summary || "";

    const body = document.createElement("div");
    body.className = "article-body";
    if (Array.isArray(article.steps) && article.steps.length) {
      const list = document.createElement("ol");
      article.steps.forEach((step) => {
        const liStep = document.createElement("li");
        liStep.textContent = step;
        list.appendChild(liStep);
      });
      body.appendChild(list);
    }

    li.appendChild(title);
    li.appendChild(summary);
    if (body.childElementCount > 0) {
      li.appendChild(body);
    }
    li.addEventListener("click", () => toggleArticle(li));
    return li;
  };

  const resolveIcon = (icon) => {
    switch (icon) {
      case "book":
        return "📖";
      case "calendar":
        return "📅";
      case "chat":
        return "💬";
      case "folder":
        return "📁";
      case "doc":
        return "📄";
      case "plate":
        return "🥗";
      case "user":
        return "👤";
      default:
        return "📌";
    }
  };

  const renderCategories = (categories) => {
    if (!refs.categories) return;
    refs.categories.innerHTML = "";
    categories.forEach((category) => {
      const card = document.createElement("article");
      card.className = "help-card is-collapsed";

      const header = document.createElement("div");
      header.className = "help-card__header";

      const icon = document.createElement("div");
      icon.className = "help-card__icon";
      icon.textContent = resolveIcon(category.icon);

      const textWrap = document.createElement("div");
      const title = document.createElement("h2");
      title.className = "help-card__title";
      title.textContent = category.title;
      const meta = document.createElement("p");
      meta.className = "help-card__meta";
      const count = category.articles?.length || 0;
      meta.textContent = `${count} artículo${count === 1 ? "" : "s"}`;
      textWrap.appendChild(title);
      textWrap.appendChild(meta);

      header.appendChild(icon);
      header.appendChild(textWrap);
      const chevron = document.createElement("span");
      chevron.className = "help-card__chevron";
      chevron.textContent = "›";
      header.appendChild(chevron);

      const desc = document.createElement("p");
      desc.className = "help-card__desc";
      desc.textContent = category.description || "";

      const list = document.createElement("ul");
      list.className = "article-list";
      (category.articles || []).forEach((article) => {
        list.appendChild(createArticleItem(article));
      });

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(list);
      refs.categories.appendChild(card);

      header.addEventListener("click", () => {
        card.classList.toggle("is-collapsed");
      });
    });
  };

  const renderSearchResults = (query) => {
    if (!refs.results) return;
    const term = query.trim().toLowerCase();
    refs.results.innerHTML = "";
    if (!term) {
      refs.results.hidden = true;
      refs.categories.hidden = false;
      return;
    }

    const matches = [];
    state.categories.forEach((category) => {
      (category.articles || []).forEach((article) => {
        const haystack = [article.title, article.summary, ...(article.tags || [])]
          .join(" ")
          .toLowerCase();
        if (haystack.includes(term)) {
          matches.push({ category: category.title, article });
        }
      });
    });

    refs.categories.hidden = true;
    refs.results.hidden = false;

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "help-empty";
      empty.textContent = "Sin resultados. Prueba con otro término.";
      refs.results.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "article-list";
    matches.forEach(({ category, article }) => {
      const item = createArticleItem(article);
      const pill = document.createElement("span");
      pill.className = "help-pill";
      pill.textContent = category;
      item.insertBefore(pill, item.firstChild);
      list.appendChild(item);
    });
    refs.results.appendChild(list);
  };

  const bindSearch = () => {
    refs.search?.addEventListener("input", (event) => {
      state.lastQuery = event.target.value || "";
      renderSearchResults(state.lastQuery);
    });
  };

  const loadData = async () => {
    try {
      const res = await fetch("../data/ayuda.json", { cache: "no-cache" });
      if (!res.ok) {
        throw new Error("No se pudo cargar el centro de ayuda.");
      }
      const data = await res.json();
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      renderCategories(state.categories);
      if (refs.statsArticles) {
        refs.statsArticles.textContent = `${countArticles(state.categories)} artículos`;
      }
    } catch (error) {
      if (refs.categories) {
        refs.categories.innerHTML = `<div class="help-empty">${error.message}</div>`;
      }
    }
  };

  const init = () => {
    bindSearch();
    loadData();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
