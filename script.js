// ==UserScript==
// @name         Netflix movie ratings
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Show IMDb & Rotten Tomatoes ratings on Netflix
// @author       You
// @match        https://www.netflix.com/*
// @connect      omdbapi.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. Configs
    const API_KEY = 'ed764a4';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    const DELAY = 600;
    const MAX_RETRIES = 3;
    const ENABLE_IMDB = true;
    const ENABLE_RT = true;

    // 2. Cache functions
    function getCachedRating(title) {
        const cacheKey = `netflix_rating_${title}`;
        const cached = localStorage.getItem(cacheKey);

        if (!cached) return null;

        const data = JSON.parse(cached);
        const now = Date.now();

        if (now - data.timestamp > CACHE_DURATION) {
            localStorage.removeItem(cacheKey);
            return null;
        }

        return data.rating;
    }

    function setCachedRating(title, ratingData) {
        const cacheKey = `netflix_rating_${title}`;
        const data = {
            rating: ratingData,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
    }

    // 3. Extract title
    function extractTitleFromModal() {
        const titleElement = document.querySelector('.previewModal--section-header strong');
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        return null;
    }

    // 4. Fetch rating from API
    async function fetchRating(title) {
        const cached = getCachedRating(title);
        if (cached) {
            console.log("Using cached rating for:", title);
            return cached;
        }

        const url = `https://www.omdbapi.com/?apikey=${API_KEY}&t=${encodeURIComponent(title)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.Response === "True") {
                const ratingData = {
                    imdb: data.imdbRating || "N/A",
                    rt: data.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A"
                };

                setCachedRating(title, ratingData);
                return ratingData;
            }

            return null;
        } catch (error) {
            console.error("Error fetching rating:", error);
            return null;
        }
    }

    // 5. Display rating on page
    function displayRating(container, ratingData) {
        // Remove existing badge if present
        const existingBadge = container.querySelector('.netflix-rating-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        const badge = document.createElement('div');
        badge.className = 'netflix-rating-badge';
        badge.innerHTML = `
            <div class="rating-item">
                <span class="rating-label">IMDb:</span>
                <span class="rating-value">${ratingData.imdb}</span>
            </div>
            <div class="rating-item">
                <span class="rating-label">RT:</span>
                <span class="rating-value">${ratingData.rt}</span>
            </div>
        `;

        badge.style.cssText = `
            position: fixed !important;
            top: 100px !important;
            right: 20px !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: #fff !important;
            padding: 12px 16px !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            font-family: Arial, sans-serif !important;
            z-index: 999999 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
            line-height: 1.5 !important;
        `;

        container.appendChild(badge);
    }

    // 6. Main function - runs when modal opens
    async function handleModal() {
        const title = extractTitleFromModal();
        if (!title) return;

        console.log("Found title:", title);

        const rating = await fetchRating(title);
        if (rating) {
            const container = document.querySelector('.about-wrapper');
            if (container) {
                displayRating(container, rating);
            }
        }
    }

    // 7. Watch for modal opening (with debounce)
    let lastProcessedTitle = null;
    let debounceTimer = null;

    const observer = new MutationObserver(() => {
        // Clear previous timer
        clearTimeout(debounceTimer);
        
        // Wait for DOM to settle
        debounceTimer = setTimeout(() => {
            const modal = document.querySelector('.previewModal--section-header');
            if (modal) {
                const title = extractTitleFromModal();
                
                // Only process if it's a new title
                if (title && title !== lastProcessedTitle) {
                    lastProcessedTitle = title;
                    handleModal();
                }
            }
        }, DELAY);
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("Netflix Rating Extension loaded!");
})();