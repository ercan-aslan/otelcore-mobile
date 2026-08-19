import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('AppErrorBoundary', error);
  }

  handleRetry = () => {
    this.setState({ error: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = String(this.state.error?.message || this.state.error || 'Bilinmeyen hata');

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Uygulama başlatılamadı</Text>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
          <Text style={styles.message}>{message}</Text>
        </ScrollView>
        <Pressable style={styles.button} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>Girişe dön</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  box: {
    maxHeight: 260,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
  },
  boxContent: {
    padding: 16,
  },
  message: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
