/* Cesar Barbershop — interaction layer (no dependencies) */
(function () {
  "use strict";

  /* ---- Sticky header shadow on scroll ---- */
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    if (window.scrollY > 24) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile nav toggle ---- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---- Reveal-on-scroll ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* ---- Lazy-load background photos with graceful fallback ----
     Any element with [data-img] gets that image as a background only
     if it actually loads. Broken/missing files keep the styled
     placeholder, so the design never shows a broken image icon. */
  document.querySelectorAll("[data-img]").forEach(function (el) {
    var src = el.getAttribute("data-img");
    if (!src) return;
    var probe = new Image();
    probe.onload = function () {
      el.style.backgroundImage =
        "linear-gradient(180deg, rgba(13,13,15,0) 55%, rgba(13,13,15,0.55)), url('" +
        src + "')";
      el.classList.add("has-img");
    };
    probe.src = src;
  });

  /* ---- Footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
