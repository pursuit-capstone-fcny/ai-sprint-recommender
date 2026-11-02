import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the intake page', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole('heading', {
        name: /what would you like to do with ai/i,
      }),
    ).toBeTruthy();
  });
});
