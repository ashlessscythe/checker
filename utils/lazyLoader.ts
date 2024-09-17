import React, { lazy } from 'react';

type LazyComponentType = () => Promise<{ default: React.ComponentType<any>}>;

export function lazyLoad(componentName: string, namedExport?: string): React.LazyExoticComponent<any> {
  const loadComponent: LazyComponentType = () =>
    import(`../components/${componentName}`).then((module) => ({
      default: namedExport ? module[namedExport] : module.default,
    }));

  return lazy(loadComponent);
}