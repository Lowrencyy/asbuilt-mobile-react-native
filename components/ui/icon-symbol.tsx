// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const MAPPING: Record<string, MaterialIconName> = {
  'house.fill':                               'home',
  'paperplane.fill':                          'send',
  'chevron.left.forwardslash.chevron.right':  'code',
  'chevron.right':                            'chevron-right',
  'checklist':                                'format-list-bulleted',
  'doc.text.fill':                            'description',
  'shippingbox.fill':                         'local-shipping',
  'person.fill':                              'person',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: unknown;
}) {
  const iconName = MAPPING[name] ?? 'help-outline';
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
