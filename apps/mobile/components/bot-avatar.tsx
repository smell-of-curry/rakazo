import {
  AVATAR_CENTER,
  AVATAR_EYE_INK,
  AVATAR_SHAPES,
  AVATAR_VIEWBOX,
  resolveAvatarColorDef,
  resolveAvatarShape,
} from "@rakazo/core";
import { memo, useEffect, useId, useState } from "react";
import { Image, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";
import { authHeaders } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { NativeSymbol } from "./native-symbol";

let imageAuthHeaders: Promise<Record<string, string>> | undefined;

function loadImageAuthHeaders(): Promise<Record<string, string>> {
  imageAuthHeaders ??= authHeaders()
    .then((headers) => {
      if (!headers.authorization) imageAuthHeaders = undefined;
      return headers;
    })
    .catch(() => {
      imageAuthHeaders = undefined;
      return {};
    });
  return imageAuthHeaders;
}

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 54,
  identity = "",
  shape,
  muted = false,
  imageSrc,
}: {
  color: string;
  size?: number;
  status?: string;
  identity?: string;
  shape?: string | null;
  muted?: boolean;
  imageSrc?: string;
}) {
  const { t } = useI18n();
  const gradId = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    setImageFailed(false);
    setImageHeaders(null);
    if (!imageSrc) return;
    let cancelled = false;
    void loadImageAuthHeaders().then((headers) => {
      if (!cancelled) setImageHeaders(headers);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);
  const colorDef = resolveAvatarColorDef(identity, color);
  const resolvedShape = resolveAvatarShape(identity, shape);
  const showImage = Boolean(imageSrc) && imageHeaders !== null && !imageFailed;
  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri: imageSrc, headers: imageHeaders }}
          onError={() => setImageFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Svg width={size} height={size} viewBox={AVATAR_VIEWBOX}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colorDef.light} />
              <Stop offset="100%" stopColor={colorDef.dark} />
            </LinearGradient>
          </Defs>
          <Path d={AVATAR_SHAPES[resolvedShape]} fill={`url(#${gradId})`} />
          <G fill={AVATAR_EYE_INK}>
            <Ellipse cx={AVATAR_CENTER - 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
            <Ellipse cx={AVATAR_CENTER + 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
          </G>
        </Svg>
      )}
      {muted ? (
        <View
          accessible
          accessibilityLabel={t("Notifications silenced")}
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: Math.max(14, Math.round(size * 0.34)),
            height: Math.max(14, Math.round(size * 0.34)),
            borderRadius: size,
            borderWidth: 2,
            borderColor: "#000",
            backgroundColor: "#242428",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol
            ios="bell.slash.fill"
            android="notifications-off"
            size={Math.max(8, Math.round(size * 0.17))}
            color="#ECECEE"
          />
        </View>
      ) : null}
    </View>
  );
});
