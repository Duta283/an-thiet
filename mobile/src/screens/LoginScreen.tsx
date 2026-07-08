import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password);
      } else {
        if (!name.trim()) throw new Error('Nhập tên hiển thị');
        await signUp(email.trim(), password, name.trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>Ăn Thiệt</Text>
      <Text style={styles.tagline}>Tìm quán ăn thật — không sao, không quảng cáo</Text>

      {mode === 'up' && (
        <TextInput
          style={styles.input}
          placeholder="Tên hiển thị"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {mode === 'in' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
        <Text style={styles.switch}>
          {mode === 'in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  tagline: {
    color: colors.textMuted,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 12,
  },
  error: { color: colors.danger, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 8,
    padding: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  switch: { color: colors.primary, marginTop: 12, textAlign: 'center' },
});
