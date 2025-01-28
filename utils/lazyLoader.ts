import React, { lazy } from "react";
import { withAutoNavigate } from "./withAutoNavigate";

type LazyComponentType = () => Promise<{ default: React.ComponentType<any> }>;

interface LazyLoadOptions {
  withAutoNav?: boolean;
  path?: string;
  fullReload?: boolean;
}

export function lazyLoad(
  componentName: string,
  options: LazyLoadOptions = {},
  namedExport?: string
): React.LazyExoticComponent<any> {
  const loadComponent: LazyComponentType = () =>
    import(`../components/${componentName}`).then((module) => {
      let Component = namedExport ? module[namedExport] : module.default;

      // Wrap with autoNavigate if specified
      if (options.withAutoNav) {
        Component = withAutoNavigate(
          Component,
          options.path,
          options.fullReload
        );
      }

      return { default: Component };
    });

  return lazy(loadComponent);
}
