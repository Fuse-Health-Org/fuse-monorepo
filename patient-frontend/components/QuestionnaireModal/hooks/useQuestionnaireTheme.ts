import { useState, useEffect, useMemo } from "react";
import { apiCall } from "../../../lib/api";
import { createTheme, buildThemeVars } from "../theme";
import { QuestionnaireData } from "../types";

export function useQuestionnaireTheme(
  isOpen: boolean,
  questionnaireId: string | undefined,
  questionnaire: QuestionnaireData | null,
  domainClinic: any
) {
  const [customColor, setCustomColor] = useState<string | null>(null);

  // Fetch custom color for this questionnaire
  useEffect(() => {
    const fetchCustomColor = async () => {
      console.log('🎨 [CUSTOM COLOR] Starting fetch...');
      console.log('🎨 [CUSTOM COLOR] questionnaireId:', questionnaireId);
      console.log('🎨 [CUSTOM COLOR] domainClinic:', domainClinic);
      console.log('🎨 [CUSTOM COLOR] domainClinic?.id:', domainClinic?.id);

      if (!questionnaireId) {
        console.log('⚠️ [CUSTOM COLOR] No questionnaireId, skipping');
        return;
      }

      if (!domainClinic?.id) {
        console.log('⚠️ [CUSTOM COLOR] No domainClinic.id, skipping');
        return;
      }

      try {
        const url = `/public/questionnaire-customization/${questionnaireId}?clinicId=${domainClinic.id}`;
        console.log('📡 [CUSTOM COLOR] Fetching from:', url);

        const result = await apiCall(url);

        console.log('📦 [CUSTOM COLOR] API result:', result);
        console.log('📦 [CUSTOM COLOR] result.success:', result.success);
        console.log('📦 [CUSTOM COLOR] result.data:', result.data);
        console.log('📦 [CUSTOM COLOR] result.data?.data:', result.data?.data);

        // The apiCall wraps the response, so we need result.data.data
        const customizationData = result.data?.data || result.data;
        console.log('📦 [CUSTOM COLOR] customizationData:', customizationData);

        if (result.success && customizationData?.customColor) {
          setCustomColor(customizationData.customColor);
          console.log('✅ [CUSTOM COLOR] Set custom color to:', customizationData.customColor);
        } else {
          setCustomColor(null);
          console.log('⚠️ [CUSTOM COLOR] No custom color found, set to null');
        }
      } catch (error) {
        console.error('❌ [CUSTOM COLOR] Error fetching:', error);
        setCustomColor(null);
      }
    };

    if (isOpen) {
      fetchCustomColor();
    }
  }, [questionnaireId, domainClinic?.id, isOpen]);

  // Priority: custom color (from QuestionnaireCustomization) > questionnaire color > clinic default color > system default
  const themeColor = customColor || questionnaire?.color || domainClinic?.defaultFormColor;

  console.log('🎨 [THEME] Computing theme color...');
  console.log('🎨 [THEME] customColor:', customColor);
  console.log('🎨 [THEME] questionnaire?.color:', questionnaire?.color);
  console.log('🎨 [THEME] domainClinic?.defaultFormColor:', domainClinic?.defaultFormColor);
  console.log('🎨 [THEME] Final themeColor:', themeColor);

  const theme = useMemo(() => {
    const result = createTheme(themeColor);
    console.log('🎨 [THEME] Created theme:', result);
    return result;
  }, [themeColor]);

  const themeVars = useMemo(
    () => {
      const vars: any = {
        "--q-primary": theme.primary,
        "--q-primary-dark": theme.primaryDark,
        "--q-primary-darker": theme.primaryDarker,
        "--q-primary-light": theme.primaryLight,
        "--q-primary-lighter": theme.primaryLighter,
        "--q-primary-text": theme.text,
      };
      
      if (theme.gradient) {
        vars["--q-primary-gradient"] = theme.gradient;
      }
      
      return vars as React.CSSProperties;
    },
    [theme]
  );

  useEffect(() => {
    console.log("[QuestionnaireModal] theme", {
      questionnaireColor: questionnaire?.color,
      theme,
    });
  }, [questionnaire?.color, theme]);

  return { theme, themeVars, customColor, setCustomColor };
}

