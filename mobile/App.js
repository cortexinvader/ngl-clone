import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import axios from 'axios';
import { THEMES } from './shared/themeConfig'; 

// !!! IMPORTANT: REPLACE THIS WITH YOUR COMPUTER'S LOCAL IP ADDRESS !!!
const API_URL = "http://192.168.1.5:3000"; 

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function App() {
  const [view, setView] = useState('login'); 
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sound, setSound] = useState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function registerForPush() {
    if (!Device.isDevice) return null;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
    return (await Notifications.getExpoPushTokenAsync()).data;
  }

  const handleAuth = async (endpoint) => {
    try {
      const pushToken = await registerForPush();
      const res = await axios.post(`${API_URL}/${endpoint}`, { username, password, pushToken });
      // Login or Register success
      const userData = endpoint === 'register' ? { ...res.data, theme_id: 0 } : res.data;
      setUser(userData);
      setView('dashboard');
      if(endpoint === 'login') fetchMessages(userData.id);
    } catch (e) {
      Alert.alert("Error", "Action failed. Check IP or credentials.");
    }
  };

  const fetchMessages = async (uid) => {
    try {
        const res = await axios.get(`${API_URL}/messages/${uid}`);
        setMessages(res.data);
    } catch(e) { console.log(e) }
  };

  async function playSound(filename) {
    const { sound } = await Audio.Sound.createAsync({ uri: `${API_URL}/uploads/${filename}` });
    setSound(sound);
    await sound.playAsync();
  }

  const theme = user ? (THEMES[user.theme_id] || THEMES[0]) : THEMES[0];
  const bg = theme.mobile_bg || theme.bg;

  if (view === 'login') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#000' }}>
        <Text style={{ fontSize: 40, color: '#8A2BE2', fontWeight: 'bold', textAlign: 'center', marginBottom: 40 }}>Txtme 👻</Text>
        <TextInput placeholder="Username" placeholderTextColor="#666" onChangeText={setUsername} style={{ backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 10 }} />
        <TextInput placeholder="Password" placeholderTextColor="#666" secureTextEntry onChangeText={setPassword} style={{ backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20 }} />
        <TouchableOpacity onPress={() => handleAuth('login')} style={{ backgroundColor: '#8A2BE2', padding: 15, borderRadius: 10, marginBottom: 10 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleAuth('register')}>
          <Text style={{ color: '#888', textAlign: 'center' }}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg.includes('gradient') ? '#41295a' : bg, paddingTop: 50 }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>Hi, {user.username}</Text>
        <Text style={{ color: theme.accent }}>{messages.length} Messages</Text>
        <Text selectable style={{ color: '#888', marginTop: 5 }}>Link: myapp.com/?u={user.username}</Text>
      </View>
      <FlatList 
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: theme.card, marginHorizontal: 10, marginBottom: 10, padding: 20, borderRadius: 15, border: theme.border }}>
             <Text style={{ color: theme.accent, fontWeight: 'bold', marginBottom: 5 }}>
              {item.game_mode !== 'none' ? item.game_mode.toUpperCase() : "SECRET MESSAGE"}
            </Text>
            {item.type === 'text' ? (
              <Text style={{ color: theme.text, fontSize: 18 }}>{item.content}</Text>
            ) : (
              <TouchableOpacity onPress={() => playSound(item.content)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 30 }}>▶️</Text>
                <Text style={{ color: theme.text }}>Play Voice Note</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <View style={{ height: 80, borderTopWidth: 1, borderColor: '#333', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <FlatList horizontal data={Object.values(THEMES)} renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => {
                axios.post(`${API_URL}/update-profile`, { userId: user.id, themeId: item.id, avatarId: user.avatar_id });
                setUser({ ...user, theme_id: item.id });
              }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.bg.includes('gradient') ? 'orange' : item.bg, margin: 10, borderWidth: 2, borderColor: '#fff' }} 
            />
          )}
        />
      </View>
    </View>
  );
}