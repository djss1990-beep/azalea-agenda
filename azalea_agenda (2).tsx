import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, User, Sparkles, X, ChevronLeft, ChevronRight, Check, Plus, Trash2, Settings, ArrowUp, ArrowDown, Edit2, Save, Image, List, BarChart2, Upload } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
let app, auth, db, appId;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'azalea-app-id';
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

// --- CONSTANTS ---
const defaultServiceOptions = [
  'Depilación Láser',
  'Manicura',
  'Masaje',
  'Pedicura',
  'Tratamiento Facial' // MUST be strictly at the end
];

const getLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- MAIN COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [allAppointments, setAllAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [services, setServices] = useState([]);
  const [customLogo, setCustomLogo] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [currentView, setCurrentView] = useState('agenda'); // 'agenda' | 'dashboard'
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [isManageTreatmentsOpen, setIsManageTreatmentsOpen] = useState(false);

  const fileInputRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        setCustomLogo(base64String);
        if (user) {
          try {
            const customRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'customization');
            await setDoc(customRef, { logoUrl: base64String, iconUrl: customIcon }, { merge: true });
          } catch (error) {
            console.error("Error saving logo:", error);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 1. Initialize Auth
  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@300;400;500;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user) return;

    // Fetch appointments
    const appointmentsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'appointments');
    const unsubscribeAppointments = onSnapshot(appointmentsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAppointments(data);
    }, (err) => {
      console.error("Firestore error:", err);
    });

    // Fetch settings (services and customization)
    const fetchSettings = async () => {
      try {
        const servicesRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'treatments');
        const docSnap = await getDoc(servicesRef);
        if (docSnap.exists()) {
          setServices(docSnap.data().list || defaultServiceOptions);
        } else {
          setServices(defaultServiceOptions);
          await setDoc(servicesRef, { list: defaultServiceOptions });
        }

        const customRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'customization');
        const customSnap = await getDoc(customRef);
        if (customSnap.exists()) {
          setCustomLogo(customSnap.data().logoUrl || '');
          setCustomIcon(customSnap.data().iconUrl || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        setServices(defaultServiceOptions);
      }
    };
    
    fetchSettings();

    return () => {
      unsubscribeAppointments();
    };
  }, [user]);

  // Dynamically update document icon (favicon) if provided
  useEffect(() => {
    if (customIcon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = customIcon;
    }
  }, [customIcon]);

  // View Filtering
  const selectedDateString = getLocalDateString(selectedDate);
  const dailyAppointments = allAppointments
    .filter(app => app.date === selectedDateString)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Handlers
  const openAddModal = () => {
    setEditingAppointment({
      date: selectedDateString,
      startTime: '09:00',
      endTime: '10:00',
      clientName: '',
      serviceType: services.length > 0 ? services[0] : ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (appointment) => {
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  };

  const saveAppointment = async (appointmentData) => {
    if (!user) return;
    const appointmentsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'appointments');
    
    try {
      if (appointmentData.id) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'appointments', appointmentData.id);
        await updateDoc(docRef, appointmentData);
      } else {
        await addDoc(appointmentsRef, appointmentData);
      }
      closeEditModal();
    } catch (error) {
      console.error("Error saving appointment:", error);
    }
  };

  const deleteAppointment = async (id) => {
    if (!user || !id) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'appointments', id);
      await deleteDoc(docRef);
      closeEditModal();
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-8 font-['Montserrat',sans-serif]">
      <div className="w-full max-w-[400px] h-[800px] max-h-[90vh] bg-white shadow-2xl overflow-hidden flex flex-col relative rounded-[2rem] border-[4px] border-black">
        
        {/* HEADER */}
        <header className="pt-12 pb-4 px-6 bg-white border-b border-gray-200 flex flex-col items-center justify-center shrink-0 shadow-[0_2px_10px_-5px_rgba(0,0,0,0.1)] z-10 relative">
          <button 
            onClick={() => setIsManageTreatmentsOpen(true)}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-black transition-colors bg-white rounded-full shadow-sm border border-gray-200"
            title="Ajustes"
          >
            <Settings size={20} />
          </button>

          <button 
            onClick={() => setCurrentView(currentView === 'agenda' ? 'dashboard' : 'agenda')}
            className="absolute top-4 left-4 p-2 text-gray-500 hover:text-black transition-colors bg-white rounded-full shadow-sm border border-gray-200"
            title={currentView === 'agenda' ? "Panel de Control" : "Agenda"}
          >
            {currentView === 'agenda' ? <BarChart2 size={20} /> : <Calendar size={20} />}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLogoUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center mt-2 group w-full"
            title="Haz clic para cambiar el logotipo"
          >
            {customLogo ? (
              <img src={customLogo} alt="Logotipo Azalea" className="h-32 w-auto object-contain my-2" />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl group-hover:border-black transition-colors w-3/4 bg-gray-50 hover:bg-gray-100">
                <Upload className="text-gray-400 group-hover:text-black mb-2" size={32} />
                <p className="text-sm text-gray-500 text-center font-medium group-hover:text-black">
                  Haz clic para subir tu logo<br/>(az.png)
                </p>
              </div>
            )}
          </div>
        </header>

        {currentView === 'agenda' ? (
          <>
            {/* AGENDA TIMELINE */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-hide">
              <div className="px-2 py-2 flex items-center justify-between">
                <h2 className="text-black text-lg capitalize font-medium">
                  {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                  {dailyAppointments.length} Citas
                </span>
              </div>

              <div className="space-y-4 pb-24">
                {dailyAppointments.length === 0 ? (
                  <div className="text-center py-10 opacity-60">
                    <p className="text-gray-500 italic">No hay citas para este día.</p>
                  </div>
                ) : (
                  dailyAppointments.map((apt) => (
                    <AppointmentCard 
                      key={apt.id} 
                      appointment={apt} 
                      onClick={() => openEditModal(apt)} 
                    />
                  ))
                )}
              </div>
            </main>

            {/* FAB (Add Appointment) */}
            <button 
              onClick={openAddModal}
              className="absolute bottom-24 right-6 bg-black text-white p-4 rounded-full shadow-xl hover:bg-gray-800 hover:scale-105 transition-all z-20 focus:outline-none border border-black"
            >
              <Plus size={24} />
            </button>

            {/* CALENDAR BOTTOM NAVIGATION */}
            <footer className="bg-white border-t border-gray-200 pb-6 pt-3 px-4 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10 relative">
              <CalendarStrip selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            </footer>
          </>
        ) : (
          <DashboardView allAppointments={allAppointments} />
        )}

        {/* EDIT MODAL */}
        {isModalOpen && (
          <EditModal 
            appointment={editingAppointment} 
            services={services}
            onSave={saveAppointment} 
            onDelete={deleteAppointment}
            onCancel={closeEditModal} 
          />
        )}

        {/* SETTINGS MODAL */}
        {isManageTreatmentsOpen && (
          <SettingsModal
            services={services}
            initialLogo={customLogo}
            initialIcon={customIcon}
            onSave={async (newServices, newLogo, newIcon) => {
              setServices(newServices);
              setCustomLogo(newLogo);
              setCustomIcon(newIcon);
              if (user) {
                try {
                  const servicesRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'treatments');
                  await setDoc(servicesRef, { list: newServices });
                  
                  const customRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'customization');
                  await setDoc(customRef, { logoUrl: newLogo, iconUrl: newIcon });
                } catch (err) {
                  console.error("Error saving settings:", err);
                }
              }
              setIsManageTreatmentsOpen(false);
            }}
            onCancel={() => setIsManageTreatmentsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function AppointmentCard({ appointment, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-black"></div>
      
      <div className="flex justify-between items-start ml-2">
        <div className="space-y-1">
          <div className="flex items-center text-black font-medium text-lg">
             <User size={16} className="mr-2 text-black" strokeWidth={1.5} />
             {appointment.clientName || 'Sin Nombre'}
          </div>
          <div className="flex items-center text-sm text-gray-500 font-light">
             <Sparkles size={14} className="mr-2 text-black" strokeWidth={1.5} />
             {appointment.serviceType}
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="flex items-center text-black font-medium text-sm bg-white px-2 py-1 rounded-md border border-gray-200">
            <Clock size={12} className="mr-1.5 text-black" strokeWidth={2} />
            {appointment.startTime} - {appointment.endTime}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarStrip({ selectedDate, setSelectedDate }) {
  const days = [];
  for (let i = -2; i <= 3; i++) {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + i);
    days.push(date);
  }

  const getDayName = (date) => date.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase();

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-3 px-2">
        <button onClick={handlePrevDay} className="p-1 text-gray-500 hover:text-black transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center text-black font-medium text-sm uppercase tracking-widest">
          <Calendar size={14} className="mr-2 text-black" />
          {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={handleNextDay} className="p-1 text-gray-500 hover:text-black transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>
      
      <div className="flex justify-between w-full">
        {days.map((date, index) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          return (
            <button
              key={index}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center justify-center w-12 h-14 rounded-full transition-all border ${
                isSelected 
                  ? 'bg-black text-white border-black shadow-md transform scale-110' 
                  : 'bg-white text-gray-500 border-transparent hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`text-[10px] font-medium mb-1 ${isSelected ? 'text-gray-300' : ''}`}>
                {getDayName(date)}
              </span>
              <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditModal({ appointment, services, onSave, onDelete, onCancel }) {
  const [formData, setFormData] = useState({ ...appointment });
  const isEditing = !!appointment.id;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90%]">
        
        <div className="bg-white px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-medium text-lg text-black">
            {isEditing ? 'Editar Cita' : 'Nueva Cita'}
          </h3>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button 
                onClick={() => onDelete(appointment.id)}
                className="p-1.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                title="Eliminar cita"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={onCancel}
              className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">Fecha</label>
            <div className="relative">
              <input 
                type="date" 
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                required
              />
              <Calendar size={16} className="absolute left-3 top-3.5 text-black" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">Cliente</label>
            <input 
              type="text" 
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              placeholder="Nombre del cliente"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-medium text-black"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">Inicio</label>
              <div className="relative">
                <input 
                  type="time" 
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                  required
                />
                <Clock size={16} className="absolute left-3 top-3.5 text-black" />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">Fin</label>
              <div className="relative">
                <input 
                  type="time" 
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                  required
                />
                <Clock size={16} className="absolute left-3 top-3.5 text-black" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">Servicio</label>
            <select 
              name="serviceType"
              value={formData.serviceType}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
            >
              {services.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 mt-2 flex gap-3">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 px-4 bg-black text-white rounded-xl font-medium shadow-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Guardar
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

function SettingsModal({ services, initialLogo, initialIcon, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState('treatments'); 
  
  // Treatments State
  const [list, setList] = useState([...services]);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');
  
  // Personalization State
  const [logoUrl, setLogoUrl] = useState(initialLogo || '');
  const [iconUrl, setIconUrl] = useState(initialIcon || '');

  // Treatment Handlers
  const handleAdd = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    // Maintain 'Tratamiento Facial' at the end
    const hasFacialAtEnd = list.length > 0 && list[list.length - 1] === 'Tratamiento Facial';
    
    if (hasFacialAtEnd) {
      const newList = [...list];
      newList.splice(newList.length - 1, 0, newItem.trim());
      setList(newList);
    } else {
      setList([...list, newItem.trim()]);
    }
    setNewItem('');
  };

  const handleRemove = (index) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newList = [...list];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setList(newList);
  };

  const handleMoveDown = (index) => {
    if (index === list.length - 1) return;
    const newList = [...list];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setList(newList);
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditValue(list[index]);
  };

  const saveEdit = (index) => {
    if (!editValue.trim()) return;
    const newList = [...list];
    newList[index] = editValue.trim();
    setList(newList);
    setEditingIndex(-1);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90%]">
        
        {/* Modal Header */}
        <div className="bg-white px-5 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <h3 className="font-medium text-lg text-black">Ajustes</h3>
          <button onClick={onCancel} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border-b border-gray-200 shrink-0">
          <button 
            onClick={() => setActiveTab('treatments')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'treatments' ? 'text-black border-b-2 border-black' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={16} />
            Tratamientos
          </button>
          <button 
            onClick={() => setActiveTab('personalization')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'personalization' ? 'text-black border-b-2 border-black' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Image size={16} />
            Personalización
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-white">
          
          {activeTab === 'treatments' && (
            <div className="space-y-4">
              <form onSubmit={handleAdd} className="flex gap-2">
                <input 
                  type="text" 
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Nuevo tratamiento..."
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-sm text-black"
                />
                <button type="submit" className="p-2 bg-black text-white rounded-xl shadow-md hover:bg-gray-800 transition-colors border border-black">
                  <Plus size={20} />
                </button>
              </form>

              <div className="space-y-2">
                {list.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => handleMoveUp(index)} disabled={index === 0} className="text-gray-400 disabled:opacity-30 hover:text-black">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => handleMoveDown(index)} disabled={index === list.length - 1} className="text-gray-400 disabled:opacity-30 hover:text-black">
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    
                    {editingIndex === index ? (
                      <input 
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(index)}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-black rounded text-sm text-black focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-black font-medium ml-1 truncate">
                        {item}
                      </span>
                    )}
                    
                    <button type="button" onClick={() => editingIndex === index ? saveEdit(index) : startEdit(index)} className="p-1.5 text-gray-500 hover:text-black transition-colors">
                      {editingIndex === index ? <Save size={16} /> : <Edit2 size={16} />}
                    </button>
                    <button type="button" onClick={() => handleRemove(index)} className="p-1.5 text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="text-center text-sm text-gray-500 italic py-4">No hay tratamientos configurados.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'personalization' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">URL del Logotipo</label>
                <input 
                  type="url" 
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-sm text-black"
                />
                <p className="text-[10px] text-gray-500 ml-1 mt-1">Este logo reemplazará el título de "AZALEA" en la cabecera.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-medium ml-1">URL del Icono (Favicon)</label>
                <input 
                  type="url" 
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="https://ejemplo.com/icon.png"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-sm text-black"
                />
                <p className="text-[10px] text-gray-500 ml-1 mt-1">Este icono se mostrará en la pestaña del navegador.</p>
              </div>

              {(logoUrl || iconUrl) && (
                <div className="mt-4 p-4 border border-gray-200 rounded-xl bg-white flex flex-col items-center gap-3">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Vista Previa</span>
                  {logoUrl && <img src={logoUrl} alt="Vista previa logo" className="h-12 object-contain" />}
                  {iconUrl && <img src={iconUrl} alt="Vista previa icono" className="h-8 w-8 object-contain rounded-full shadow-sm" />}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white p-4 border-t border-gray-200 shrink-0">
          <button 
            onClick={() => onSave(list, logoUrl, iconUrl)}
            className="w-full py-3 px-4 bg-black text-white rounded-xl font-medium shadow-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 border border-black"
          >
            <Save size={18} />
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ allAppointments }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
  const [endDate, setEndDate] = useState(getLocalDateString(lastDay));

  const filtered = allAppointments.filter(app => app.date >= startDate && app.date <= endDate);
  const total = filtered.length;

  const counts = {};
  filtered.forEach(app => {
    counts[app.serviceType] = (counts[app.serviceType] || 0) + 1;
  });

  const stats = Object.entries(counts)
    .map(([name, count]) => ({ 
      name, 
      count, 
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0 
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <main className="flex-1 overflow-y-auto p-5 bg-white scrollbar-hide flex flex-col gap-6">
      <div className="space-y-4">
        <h2 className="font-medium text-black text-xl border-b border-gray-200 pb-2">Panel de Control</h2>
        
        {/* Date Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Desde</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-none bg-transparent focus:ring-0 text-black font-medium text-right outline-none"
            />
          </div>
          <div className="h-px bg-gray-200 w-full"></div>
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Hasta</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-none bg-transparent focus:ring-0 text-black font-medium text-right outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-black text-white p-5 rounded-2xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden border border-black">
        <Sparkles size={60} className="absolute -right-4 -top-4 opacity-10 text-white" />
        <span className="text-sm uppercase tracking-widest font-medium opacity-90 mb-1">Total Tratamientos</span>
        <span className="text-5xl font-medium">{total}</span>
      </div>

      {/* Breakdowns */}
      <div className="space-y-3 pb-8">
        <h3 className="font-medium text-black text-lg">Desglose por Servicio</h3>
        {stats.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4 text-center">No hay datos en este rango de fechas.</p>
        ) : (
          stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-black font-medium text-sm">{stat.name}</span>
                <div className="text-right">
                  <span className="text-lg font-medium text-black">{stat.count}</span>
                  <span className="text-xs text-gray-500 ml-2">({stat.percentage}%)</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200 mt-1">
                <div 
                  className="bg-black h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stat.percentage}%` }}
                ></div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}