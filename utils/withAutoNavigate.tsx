import React from "react";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { getAutoNavigateTimeout } from "@/lib/config";

export function withAutoNavigate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  path: string = "/",
  fullReload: boolean = true
) {
  return function WithAutoNavigateComponent(props: P) {
    useAutoNavigate(path, getAutoNavigateTimeout(), fullReload);
    return <WrappedComponent {...props} />;
  };
}
