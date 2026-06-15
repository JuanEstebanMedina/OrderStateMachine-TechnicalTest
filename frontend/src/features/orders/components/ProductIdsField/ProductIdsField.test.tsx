import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProductIdsField } from './ProductIdsField';
import { parseProductIds } from './productIdsParser';

describe('parseProductIds', () => {
  it('parses comma-separated IDs', () => {
    expect(parseProductIds('product-1,product-2')).toEqual([
      'product-1',
      'product-2',
    ]);
  });

  it('parses line-break-separated IDs', () => {
    expect(parseProductIds('product-1\nproduct-2')).toEqual([
      'product-1',
      'product-2',
    ]);
  });

  it('handles mixed separators, trimming, empty values, and deduplication', () => {
    expect(parseProductIds(' product-1,\n product-2,,product-1 \n ')).toEqual([
      'product-1',
      'product-2',
    ]);
  });
});

describe('ProductIdsField', () => {
  it('shows product count and removable tokens', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProductIdsField
        value={'product-1\nproduct-2'}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/2 products recognized/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove product-1/i }));

    expect(onChange).toHaveBeenCalledWith('product-2');
  });
});
