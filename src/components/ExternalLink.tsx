import React from 'react';
import { Text, TouchableOpacity, Linking, Platform, StyleSheet, TextProps } from 'react-native';

interface ExternalLinkProps extends TextProps {
  href: string;
  children: React.ReactNode;
}

export function ExternalLink({ href, children, style, ...props }: ExternalLinkProps) {
  const handlePress = async () => {
    try {
      const supported = await Linking.canOpenURL(href);
      if (supported) {
        await Linking.openURL(href);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text style={[styles.link, style]} {...props}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
