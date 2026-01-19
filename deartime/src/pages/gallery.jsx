import { useNavigate, useLocation } from "react-router-dom"; 
import '../styles/gallery.css';
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Pen, Trash2, MoreVertical } from "lucide-react"; 
import bg from "../assets/background_nostar.png";
import AlbumCreateModal from "../components/AlbumCreateModal";

// 1. 서버 주소 설정
const BASE_URL = "http://ec2-43-203-87-207.ap-northeast-2.compute.amazonaws.com:8080";

const Gallery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isLongPressActive = useRef(false);

  const tabs = ["RECORD", "ALBUM"];
  const [activeIndex, setActiveIndex] = useState(location.state?.activeTab ?? 0);

  // 2. 서버 데이터를 담을 상태 (초기값 빈 배열)
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const [menu, setMenu] = useState({ show: false, x: 0, y: 0, targetId: null, type: null, isCentered: false }); 
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 공통 헤더 (토큰 포함)
  const getAuthHeaders = () => ({
    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
  });

  // 3. [조회] 명세서에 따른 사진 및 앨범 목록 가져오기
  const fetchAllData = async () => {
    try {
      setLoading(true);
      // 사진 목록 조회 (정렬 및 페이징 파라미터 적용)
      const photoRes = await fetch(`${BASE_URL}/api/photos?sort=takenAt,desc&page=0&size=20`, {
        headers: getAuthHeaders()
      });
      const photoData = await photoRes.json();

      // 앨범 목록 조회
      const albumRes = await fetch(`${BASE_URL}/api/albums`, {
        headers: getAuthHeaders()
      });
      const albumData = await albumRes.json();

      // 서버 응답 구조가 { data: [...] } 형태인지 확인 필요
      setPhotos(photoData.data || photoData || []);
      setAlbums(albumData.data || albumData || []);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const handleClick = () => setMenu(prev => ({ ...prev, show: false }));
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // 4. [업로드] 사진 파일을 서버로 전송
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file); // 백엔드 키값 확인 필요

    try {
      const response = await fetch(`${BASE_URL}/api/photos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (response.ok) {
        fetchAllData(); // 업로드 성공 후 목록 새로고침
        e.target.value = '';
      }
    } catch (error) {
      alert("업로드 실패!");
    }
  };

  // 5. [삭제] 사진 및 앨범 삭제 (명세서 주소 적용)
  const handleDelete = async () => {
    const url = menu.type === 'photo' 
      ? `${BASE_URL}/api/photos/${menu.targetId}` 
      : `${BASE_URL}/api/albums/${menu.targetId}`;

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        if (menu.type === 'photo') setPhotos(prev => prev.filter(p => p.id !== menu.targetId));
        else setAlbums(prev => prev.filter(a => a.id !== menu.targetId));
      }
    } catch (error) {
      alert("삭제 실패");
    }
    setMenu(prev => ({ ...prev, show: false }));
  };

  // 6. [수정] 캡션 및 타이틀 수정 (명세서에 따라 POST 사용)
  const handleEditComplete = async (e, id) => {
    if (e.key === 'Enter') {
      const newValue = e.target.value;
      const isPhoto = activeIndex === 0;
      
      const url = isPhoto 
        ? `${BASE_URL}/api/photos/${id}/caption` 
        : `${BASE_URL}/api/albums/${id}/title`;

      const body = isPhoto ? { caption: newValue } : { title: newValue };

      try {
        const response = await fetch(url, {
          method: "POST", // 명세서 기준 POST
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          if (isPhoto) setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption: newValue } : p));
          else setAlbums(prev => prev.map(a => a.id === id ? { ...a, title: newValue } : a));
        }
      } catch (error) {
        alert("수정 실패");
      }
      setEditingId(null);
    } else if (e.key === 'Escape') setEditingId(null);
  };

  // 7. [앨범 생성] 모달 연동
  const handleCreateAlbum = async (albumData) => {
    try {
      const response = await fetch(`${BASE_URL}/api/albums`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: albumData.title })
      });
      if (response.ok) {
        fetchAllData(); // 생성 후 목록 새로고침
        setIsModalOpen(false);
      }
    } catch (error) {
      alert("앨범 생성 실패");
    }
  };

  // --- 기존 인터랙션 로직 ---
  const startPress = (e, id, type) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    const currentTarget = e.currentTarget;
    isLongPressActive.current = false;
    longPressTimerRef.current = setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      setMenu({ show: true, x, y, targetId: id, type, isCentered: true });
      isLongPressActive.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); 
  };

  const cancelPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemClick = (e, album = null) => {
    if (isLongPressActive.current) {
      e.stopPropagation();
      isLongPressActive.current = false;
      return;
    }
    if (album) handleAlbumClick(album);
  };

  const handleAlbumClick = (album) => {
    if (editingId) return;
    navigate(`/album/${album.id}`, { state: { album } });
  };

  const handleContextMenu = (e, id, type) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    setMenu({ show: true, x, y, targetId: id, type: type, isCentered: true });
    isLongPressActive.current = true;
  };

  const handleAlbumMenuClick = (e, albumId) => {
    e.stopPropagation(); 
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ show: true, x: rect.left - 160, y: rect.bottom + 10, targetId: albumId, type: 'album', isCentered: false });
  };

  const handleEditStart = (e) => {
    e.stopPropagation();
    setEditingId(menu.targetId);
    setMenu(prev => ({ ...prev, show: false }));
  };

  const groupedPhotos = useMemo(() => {
    return photos.reduce((acc, photo) => {
      // 명세서 상 날짜 필드(takenAt 등)에 맞춰 date 추출 로직 수정이 필요할 수 있습니다.
      const date = photo.takenAt?.split('T')[0].replace(/-/g, '.') || photo.date || "Unknown";
      if (!acc[date]) acc[date] = [];
      acc[date].push(photo);
      return acc;
    }, {});
  }, [photos]);
  
  const sortedAlbums = useMemo(() => {
    return [...albums].sort((a, b) => (a.isFavorite === b.isFavorite ? 0 : a.isFavorite ? -1 : 1));
  }, [albums]);

  if (loading) return <div className="gallery-container" style={{color: 'white', padding: '50px'}}>데이터를 불러오는 중...</div>;

  return (
    <div className="gallery-container" style={{ backgroundImage: `url(${bg})` }}>
      <AlbumCreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={handleCreateAlbum} 
      />

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />

      {(menu.show || editingId !== null) && <div className="context-menu-overlay" />}

      {menu.show && (
        <div className={`custom-context-menu ${menu.isCentered ? 'centered' : ''}`} style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-item" onClick={handleEditStart}>
            <Pen size={15} color="white" />
            <span>{menu.type === 'photo' ? '캡션 수정' : '이름 수정'}</span>
          </div>  
          <div className="menu-divider" />
          <div className="menu-item delete" onClick={handleDelete}>
            <Trash2 size={15} color="#FF4D4D" />
            <span>삭제</span>
          </div>
        </div>
      )}

      {/* 상단 탭 영역 */}
      <div className="tc-topbar">
        <div className="gallery-topnav">
          {tabs.map((tab, index) => (
            <span
              key={tab}
              onClick={() => setActiveIndex(index)}
              className={`gallery-tab ${index === activeIndex ? 'active' : ''}`}
            >
              {tab}
              <span className="gallery-tab-underline" />
            </span>
          ))}
        </div>
        <div className="tc-topbar-right">
          <button
            type="button"
            className="tc-create-btn"
            onClick={() => activeIndex === 0 ? fileInputRef.current.click() : setIsModalOpen(true)}
          >
            {activeIndex === 0 ? '업로드' : '생성'}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="gallery-content-wrapper">
        {activeIndex === 0 ? (
          Object.keys(groupedPhotos).map((date) => (
            <section key={date} className="date-group">
              <h2 className="date-title">{date}</h2>
              <div className="photo-grid">
                {groupedPhotos[date].map((photo) => {
                  const isSpotlight = (menu.show && menu.targetId === photo.id) || (editingId === photo.id);
                  return (
                    <div 
                      key={photo.id} 
                      className={`photo-item ${isSpotlight ? 'spotlight' : ''}`} 
                      onContextMenu={(e) => handleContextMenu(e, photo.id, 'photo')}
                      onMouseDown={(e) => startPress(e, photo.id, 'photo')}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={(e) => startPress(e, photo.id, 'photo')}
                      onTouchEnd={cancelPress}
                      onClick={(e) => handleItemClick(e)} 
                    >
                      <div className="img-box">
                        <img src={photo.url} alt="" />
                      </div>
                      {editingId === photo.id ? (
                        <input 
                          className="edit-title-input" 
                          defaultValue={photo.caption || photo.title} 
                          autoFocus 
                          onKeyDown={(e) => handleEditComplete(e, photo.id)} 
                          onBlur={() => setEditingId(null)} 
                        />
                      ) : (
                        <p className="photo-title">{photo.caption || photo.title}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="album-section">
            <div className="album-grid">
              {sortedAlbums.map((album) => {
                const isSpotlight = (menu.show && menu.targetId === album.id) || (editingId === album.id);
                return (
                  <div key={album.id} className={`album-item ${isSpotlight ? 'spotlight' : ''}`} onClick={(e) => handleItemClick(e, album)}>
                    <div className="album-img-box">
                      <img src={album.coverUrl || 'https://via.placeholder.com/300'} alt="" />
                    </div>
                    <div className="album-info">
                      <div className="album-info-top">
                        {editingId === album.id ? (
                          <input 
                            className="edit-title-input" 
                            defaultValue={album.title} 
                            autoFocus 
                            onKeyDown={(e) => handleEditComplete(e, album.id)} 
                            onBlur={() => setEditingId(null)} 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        ) : (
                          <h3>{album.title}</h3>
                        )}
                        <button className="album-menu-trigger" onClick={(e) => handleAlbumMenuClick(e, album.id)}>
                          <MoreVertical size={24} color="white" />
                        </button>
                      </div>
                      <p>항목 {album.count || 0} 개</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;