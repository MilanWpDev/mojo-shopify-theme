/* =============== SFQ helper =============== */
async function sfq(query, variables = {}) {
  const res = await fetch('https://fishingwithmilan.myshopify.com/api/2024-10/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': '69f011592c741ca093600043ff66dc63'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) console.error('[SFQ errors]', json.errors);
  return json.data;
}

sfq(`{ shop { name } }`).then(d => console.log('[shop]:', d?.shop?.name));

/* =============== Radi na SVIM kolekcijama =============== */
(function runOnCollectionPage() {
  const norm = location.pathname.replace(/\/+$/,'');
  if (!/\/collections\//.test(norm)) return;

  const urlHandle = (() => {
    const m = norm.match(/\/collections\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();
  const handle = (window.COLLECTION_HANDLE || urlHandle || 'all').toString();
  console.log('[milan] collection handle:', handle);

  const waitForEl = (sels, t=7000) => new Promise(resolve=>{
    const find = () => sels.map(s => document.querySelector(s)).find(Boolean);
    let el = find(); if (el) return resolve(el);
    const mo = new MutationObserver(() => { el = find(); if (el) { mo.disconnect(); resolve(el); }});
    mo.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(()=>{ mo.disconnect(); resolve(null); }, t);
  });

  const fmtPrice = (amount, currency) => {
    const n = Number(amount); if (Number.isNaN(n)) return '';
    const dec = currency === 'RSD' ? 0 : 2;
    return `${n.toFixed(dec)} ${currency}`;
  };

  const productCard = (p) => `
    <div class="milan-product">
      <a href="/products/${p.handle}" class="milan-product__link">
        ${p.featuredImage?.url
          ? `<img class="milan-product__img" src="${p.featuredImage.url}" alt="${p.featuredImage.altText || p.title}">`
          : `<div class="milan-product__ph"></div>`}
        <h3 class="milan-product__title">${p.title}</h3>
        <p class="milan-product__price">${fmtPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}</p>
      </a>
    </div>
  `;

  (async () => {
    const host =
      (await waitForEl(['.collection__products','[data-product-grid]','#CollectionProductGrid','main .page-width','.collection'])) ||
      (() => { const m = document.querySelector('main') || document.body; const d = document.createElement('div'); d.className='milan-collection-inject'; m.appendChild(d); return d; })();

    const shell = document.createElement('div');
    shell.className = 'milan-products-grid milan-products-grid--loading';
    shell.innerHTML = Array.from({length: 8}).map(()=>`
      <div class="milan-product milan-product--skeleton">
        <div class="milan-product__ph"></div>
        <div class="milan-product__line"></div>
        <div class="milan-product__line milan-product__line--sm"></div>
      </div>
    `).join('');
    host.appendChild(shell);

    // 1) probaj kao kolekciju
    const Q_COLLECTION = `
      query($h:String!, $n:Int!){
        collection(handle:$h){
          id title
          products(first:$n){ edges{ node{
            id handle title availableForSale
            featuredImage{ url altText }
            priceRange{ minVariantPrice{ amount currencyCode  } }
           
          }}} 
        }
      }`;
    let data = await sfq(Q_COLLECTION, { h: handle, n: 12 });
    let edges = data?.collection?.products?.edges;

    // 2) fallback: ako kolekcija ne postoji ILI je handle baš "all" → listaj globalne proizvode
    if (!data?.collection || handle === 'all') {
      console.warn('[milan] falling back to global products list');
      const Q_ALL = `
        query($n:Int!){
          products(first:$n, sortKey:CREATED_AT, reverse:true){
            edges{ node{
              id handle title availableForSale
              featuredImage{ url altText }
              priceRange{ minVariantPrice{ amount currencyCode } }
               
            }}
          }
        }`;
      data = await sfq(Q_ALL, { n: 12 });
      edges = data?.products?.edges;
    }

    console.log('[milan] fetched products:', edges?.length || 0);

    shell.classList.remove('milan-products-grid--loading');
    shell.innerHTML = (edges && edges.length)
      ? edges.map(({node}) => productCard(node)).join('')
      : `<div class="milan-empty">Još nema proizvoda za prikaz.</div>`;
  })();
})();

