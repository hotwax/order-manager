import { executeSolrQuery, solrDocs, solrTotal, escapeSolrValue, type SolrQuery } from '@common';

type ProductSearchParams = {
  keyword?: string;
  sort?: string;
  qf?: string;
  viewSize?: number;
  viewIndex?: number;
  filters?: Record<string, { value: string | string[]; op?: string }>;
};

const PRODUCT_QF = 'productId^20 productName^40 internalName^30 search_goodIdentifications parentProductName';

function buildProductSearchQuery(params: ProductSearchParams): SolrQuery {
  const rows = params.viewSize ?? 100;
  const keyword = params.keyword?.trim();
  const filter = ['docType:PRODUCT'];

  const query: SolrQuery = {
    query: '*:*',
    filter,
    sort: 'sort_productName asc',
    limit: rows,
    offset: rows * (params.viewIndex ?? 0),
    params: {
      qf: PRODUCT_QF,
      defType: 'edismax'
    }
  };

  if (keyword) {
    // A leading-quote keyword means an exact phrase; otherwise tokenize and OR the escaped tokens.
    if (keyword.startsWith('"')) {
      query.query = `(${keyword.replace(/"/g, '')})`;
    } else {
      const tokens = keyword.split(/\s+/).map(escapeSolrValue).filter(Boolean);
      query.query = `(${tokens.map((token) => `${token}*`).join(' OR ')} OR "${escapeSolrValue(keyword)}"^100)`;
    }
  } else {
    if (params.qf) query.params!.qf = params.qf;
    if (params.sort) query.sort = params.sort;
  }

  if (params.filters) {
    Object.keys(params.filters).forEach((key) => {
      const filterValue = params.filters![key].value;

      if (Array.isArray(filterValue)) {
        const op = params.filters![key].op ?? 'OR';
        filter.push(`${key}:(${filterValue.join(` ${op} `)})`);
      } else {
        filter.push(`${key}:${filterValue}`);
      }
    });
  }

  if (!params.filters?.isVirtual) {
    filter.push('isVirtual:false');
  }

  return query;
}

export async function searchProducts(params: ProductSearchParams): Promise<{ products: any[]; total: number }> {
  try {
    const response = await executeSolrQuery(buildProductSearchQuery(params));
    const total = solrTotal(response);

    return total > 0 ? { products: solrDocs(response), total } : { products: [], total: 0 };
  } catch (err) {
    return Promise.reject({
      code: 'error',
      message: 'Something went wrong',
      serverResponse: err
    });
  }
}
