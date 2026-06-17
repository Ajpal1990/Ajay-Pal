(function () {
    'use strict';
    function qs(root, selector) {
        return root.querySelector(selector);
    }
    function qsa(root, selector) {
        return Array.prototype.slice.call(root.querySelectorAll(selector));
    }
    function stripHtml(html) {
        var div = document.createElement('div');
        div.innerHTML = html || '';
        return (div.textContent || div.innerText || '').trim();
    }
    function formatMoney(cents) {
        return '$' + (cents / 100).toFixed(2);
    }
    function getOptionValues(product, optionIndex) {
        var values = [];
        product.variants.forEach(function (variant) {
            var value = variant.option[optionIndex];
            if (values.indexOf(value) === -1) values.push(value);
        });
        return values;
    }

    function ProductGrid(section) {
        this.section = section;
        this.sectionId = section.getAttribute('data-section-id');
        this.bonusHandle = section.getAttribute('data-bonus-product-handle');
        this.bonusProductPromise = null;

        this.popup = qs(section, '[data-product-popup]');
        this.imageE1 = qs(this.popup, '[data-popup-image]');
        this.titleE1 = qs(this.popup, '[data-popup-title]');
        this.priceE1 = qs(this.popup, '[data-popup-price]');
        this.descriptionE1 = qs(this.popup, '[data-popup-description]');
        this.optionsE1 = qs(this.popup, '[data-popup-options]');
        this.addToCartBtn = qs(this.popup, '[data-popup-add-to-cart]');
        this.addToCartLabel = qs(this.popup, '[data-add-to-cart-label]');

        this.product = null;
        this.variant = null;
        this.selectedOptions = [];

        this.bindEvents();
    }

    ProductGrid.prototype.bindEvents = function () {
        var self = this;

        this.section.addEventListener('click', function (event) {
            var hotspot = event.target.closest('[data-product-hotspot]');
            if (hotspot) {
                self.open(hotspot.getAttribute('data-product-handle'));
                return;
            }
            if (event.target.closest('[data-popup-close]')) {
                self.close();
            }
        });

        this.addToCartBtn.addEventListener('click', function () {
            self.addToCart();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !self.popup.hidden) {
                self.addToCart();
            }
        });
    };

    ProductGrid.prototype.open = function (handle) {
        var self = this;

        fetch('/products/' + handle + '.js')
            .then(function (response) {
                if (!response.ok) throw new Error('product fetch failed: ' + handle);
                return response.json();
            })
            .then(function (product) {
                self.product = product;
                self.variant = product.variants[0];
                self.selectedOptions = self.variant.options.slice();

                self.titleE1.textContent = product.title;
                self.descriptionE1.textContent = stripHtml(product.description).slice(0, 200);

                self.renderOptions();
                self.updateVariantUI();

                self.popup.hidden = false;
                document.body.style.overflow = 'hidden';
            })
            .catch(function (error) {
                console.error(error);
            });
    };

    ProductGrid.prototype.close = function () {
        this.popup.hidden = true;
        document.body.style.overflow = '';
    };

    ProductGrid.prototype.renderOptions = function () {
        var self = this;
        var product = this.product;
        var prefix = 'product-popup-' + this.sectionId + '__';

        this.optionsE1.innerHTML = '';

        var hasRealOptions = !(product.options.length === 1 && product.options[0].toLowerCase() === 'title');
        if (!hasRealOptions) return;

        product.options.forEach(function (optionName, optionIndex) {
            var group = document.createElement('div');
            group.className = prefix + 'option-group';

            var label = document.createElement('span');
            label.className = prefix + 'option-label';
            label.textContent = optionName;
            group.appendChild(label);

            if (optionName.toLowerCase() === 'size') {
                group.appendChild(self.builSizeSelect(optionIndex, prefix));
            } else {
                group.appendChild(self.builSwatches(optionIndex, prefix));
            }
            self.optionsE1.appendChild(group);
        });
    };

    ProductGrid.prototype.builSwatches = function (optionIndex, prefix) {
        var self = this;
        var wrap = document.createElement('div');
        wrap.className = prefix + 'swatches';

        getOptionValues(this.product, optionIndex).forEach(function (value) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = prefix + 'swatch';
            button.textContent = value;
            button.setAttribute('aria-pressed', String(self.selectedOptions[optionIndex] === value));

            button.addEventListener('click', function () {
                self.selectedOptions[optionIndex] = value;
                qsa(wrap, '.' + prefix + 'swatch').forEach(function (btn) {
                    btn.setAttribute('aria-pressed', String(btn.textContent === value));
                });
                self.updateVariantUI();
            });
            wrap.appendChild(button);
        });
        return wrap;
    };

    ProductGrid.prototype.builSizeSelect = function (optionIndex, prefix) {
        var self = this;
        var select = document.createElement('option');
        placeholder.textContent = 'choose your size';
        placeholder.disabled = true;
        placeholder.value = '';
        select.appendChild(placeholder);

        getOptionValues(this.product, optionIndex).forEach(function (value) {
            var option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            if (self.selectedOptions[optionIndex] === value) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('change', function () {
            self.selectedOptions[optionIndex] = select.value;
            self.updateVariantUI();
        });
        return select;
    };

    ProductGrid.prototype.findVariant = function () {
        var options = this.selectedOptions;
        return this.product.variants.find(function (variant) {
            return variant.options.every(function (value, index) {
                return value === options[index];
            });
        });
    };

    ProductGrid.prototype.updateVariantUI = function () {
        this.variant = this.findVariant();
        var image = (this.variant && this.variant.featured_image && this.variant.featured_image.src) || this.product.featured_image;
        this.imageE1.src = image;
        this.imageE1.alt = this.product.title;

        this.priceE1.textContent = this.variant ? formatMoney(this.variant.price) : '';

        var available = !!(this.variant && this.variant.available);
        this.addToCartBtn.disabled = !available;
        this.addToCartLabel.textContent = !this.variant ? 'unavailable' : (available ? 'Add to cart' : 'sold out');
    };

    ProductGrid.prototype.wantBonusProduct = function () {
        if (!this.bonusHandle) return false;
        var hasBlack = this.selectedOptions.some(function (value) {
            return String(value).trim().toLowerCase() === 'black';
        });
        var hasMedium = this.selectedOptions.some(function (value) {
            return String(value).trim().toLowerCase() === 'medium';
        });
        return hasBlack && hasMedium;
    };

    ProductGrid.prototype.getBonusProduct = function () {
        if (!this.bonusProductPromise) {
            this.bonusProductPromise = fetch('/product/' + this.bonusHandle + '.js').then(function (response) {
                return response.json();
            });
        }
        return this.bonusProductPromise;
    };

    ProductGrid.prototype.addToCart = function () {
        var self = this;
        if (!this.variant) return;

        this.addToCartBtn.disabled = true;
        var items = [{ id: this.variant.id, quantity: 1 }];

        var addItems = this.wantBonusProduct()
            ? this.getBonusProduct().then(function (bonusProduct) {
                items.push({ id: bonusProduct.variants[0].id, quantity: 1 });
                return items;
            })
            : Promise.resolve(items);

        addItems
            .then(function (finalItems) {
                return fetch('/cart/add.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: finalItems }),
                });
            })
            .then(function (response) {
                if (!response.ok) throw new Error('Add to cart failed');
                return response.json();
            })
            .then(function () {
                document.dispatchEvent(new CustomEvent('cart:updated'));
                self.close();
            })
            .catch(function (error) {
                console.error(error);
                self.addToCartLabel.textContent = 'somthing went wrong';
            })
            .finally(function () {
                self.addToCartLabel.disabled = false;
            });
    };

    document.addEventListener('DOMContentLoaded', function () {
        qsa(document, '[data-section-id]').forEach(function (section) {
            if (qs(section, '[data-product-popup]')) {
                new ProductGrid(section);
            }
        });
    });
});