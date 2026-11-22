import { useEffect, useRef, useState } from "react";

import { createUserLocationController } from "./userLocationController.js";

export function useUserLocation(onLocation) {
  const controller = useRef(null);
  const [state, setState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    const locationController = createUserLocationController({
      geolocation: navigator.geolocation, permissions: navigator.permissions,
      onLocation, onStatus: setState,
    });
    controller.current = locationController;
    void locationController.startIfGranted();
    return () => {
      locationController.dispose();
      controller.current = null;
    };
  }, [onLocation]);

  return {
    ...state,
    requestLocation: () => controller.current?.start(),
    cancel: () => controller.current?.cancel(),
  };
}
