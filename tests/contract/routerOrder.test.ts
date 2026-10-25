import { describe, it, expect } from 'vitest';
import { app } from '@/app';

function getRoutesFromLayer(layer: any, prefix = ''): { path: string; fullPath: string }[] {
  const routes: { path: string; fullPath: string }[] = [];

  if (layer.route) {
    routes.push({
      path: layer.route.path,
      fullPath: prefix + layer.route.path,
    });
  } else if (layer.name === 'router' && layer.handle?.stack) {
    let newPrefix = prefix;
    if (layer.regexp) {
      // Extract mounted route prefix if possible
      const match = layer.regexp.source
        .replace('^\\', '')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace('(?=\\/|$)', '')
        .replace('^', '');
      if (match && !match.startsWith('(?=')) {
        newPrefix += match.replace(/\\\//g, '/');
      }
    }

    // Check children in this specific sub-router
    const subRoutes: string[] = [];
    for (const subLayer of layer.handle.stack) {
      if (subLayer.route) {
        subRoutes.push(subLayer.route.path);
      }
    }

    // Verify ordering inside this sub-router stack:
    // A parameterized route like '/:id' or ending with '/:id' must not precede a static route with same prefix
    let seenParamId = false;
    for (const r of subRoutes) {
      if (r === '/:id' || r.startsWith('/:id')) {
        seenParamId = true;
      } else if (seenParamId && !r.includes(':')) {
        // Found static route AFTER a /:id route
        throw new Error(
          `Static route "${r}" was mounted AFTER parameterized route "/:id" under ${newPrefix}`
        );
      }
    }

    for (const subLayer of layer.handle.stack) {
      routes.push(...getRoutesFromLayer(subLayer, newPrefix));
    }
  }

  return routes;
}

describe('Router Order Contract (04 §10)', () => {
  it('ensures no static routes are shadowed by preceding :id parameter routes', () => {
    const appRouter = (app as any)._router;
    expect(appRouter).toBeDefined();

    // Should not throw
    expect(() => {
      for (const layer of appRouter.stack) {
        getRoutesFromLayer(layer);
      }
    }).not.toThrow();
  });
});
