import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Card, Image, Button, Nav, Tab, Modal, Form, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import DefaultAvatar from '../components/common/DefaultAvatar';

const ProfilePage = () => {
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', imageUrl: '' });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  
  // 현재 로그인한 사용자 정보
  const { user: currentUser } = useSelector(state => state.auth);
  const isOwnProfile = currentUser && currentUser.username === username;

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        // 사용자 프로필 정보 가져오기
        const profileResponse = await fetch(`http://localhost:5000/api/users/profile/${username}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!profileResponse.ok) {
          throw new Error('프로필을 찾을 수 없습니다.');
        }
        
        const profileData = await profileResponse.json();
        
        // 사용자 게시물 가져오기
        const postsResponse = await fetch(`http://localhost:5000/api/posts/user/${username}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        let userPosts = [];
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          userPosts = postsData.posts || [];
        }
        
        setProfile({
          ...profileData.user,
          posts: userPosts
        });
        
        setEditForm({
          bio: profileData.user.bio || '',
          imageUrl: profileData.user.profile_picture || ''
        });
        
      } catch (error) {
        console.error('프로필 로딩 오류:', error);
        // 에러 시 기본값 설정
        setProfile({
          username: username,
          bio: '프로필을 불러올 수 없습니다.',
          profilePicture: 'https://via.placeholder.com/150',
          joinDate: new Date().toISOString().split('T')[0],
          followers: 0,
          following: 0,
          posts: []
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (username) {
      fetchProfileData();
    }
  }, [username]);

  // 프로필 편집 모달 열기
  const handleEditProfile = () => {
    setShowEditModal(true);
    setAlert({ show: false, type: '', message: '' });
  };

  // 프로필 편집 폼 변경
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 프로필 업데이트 (기본 정보)
  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bio: editForm.bio
        })
      });

      if (response.ok) {
        setAlert({ 
          show: true, 
          type: 'success', 
          message: '프로필이 업데이트되었습니다!' 
        });
        // 프로필 정보 갱신
        setProfile(prev => ({
          ...prev,
          bio: editForm.bio
        }));
      } else {
        const error = await response.json();
        setAlert({ 
          show: true, 
          type: 'danger', 
          message: error.message || '프로필 업데이트에 실패했습니다.' 
        });
      }
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'danger', 
        message: '네트워크 오류가 발생했습니다.' 
      });
    }
  };

  // SSRF 취약점이 있는 이미지 업데이트
  const handleUpdateProfileImage = async () => {
    if (!editForm.imageUrl.trim()) {
      setAlert({ 
        show: true, 
        type: 'warning', 
        message: '이미지 URL을 입력해주세요.' 
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/users/profile/image/unsafe', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: editForm.imageUrl
        })
      });

      const result = await response.json();

      if (response.ok) {
        setAlert({ 
          show: true, 
          type: 'success', 
          message: '프로필 이미지가 업데이트되었습니다.' 
        });
        
        // 프로필 이미지 업데이트 및 입력 필드 초기화
        if (editForm.imageUrl.includes('http')) {
          setProfile(prev => ({
            ...prev,
            profilePicture: editForm.imageUrl
          }));
          // 성공적으로 저장된 후 입력 필드 초기화
          setEditForm(prev => ({
            ...prev,
            imageUrl: ''
          }));
        }
      } else {
        setAlert({ 
          show: true, 
          type: 'danger', 
          message: result.message || '이미지 업데이트에 실패했습니다.'
        });
      }
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'danger', 
        message: '네트워크 오류가 발생했습니다: ' + error.message 
      });
    }
  };

  if (loading) {
    return <Container className="mt-5"><p>로딩 중...</p></Container>;
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col md={4}>
          <Card>
            <Card.Body className="text-center">
              {profile.profilePicture && profile.profilePicture !== 'default-profile.png' ? (
                <Image
                  src={profile.profilePicture}
                  roundedCircle
                  width={150}
                  height={150}
                  className="mb-3"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <div style={{ display: profile.profilePicture && profile.profilePicture !== 'default-profile.png' ? 'none' : 'flex', justifyContent: 'center' }}>
                <DefaultAvatar 
                  username={profile.username} 
                  size={150}
                  className="mb-3"
                />
              </div>
              <h3>{profile.username}</h3>
              {isOwnProfile && profile.email && (
                <p className="text-muted">
                  <i className="bi bi-envelope"></i> {profile.email}
                </p>
              )}
              {isOwnProfile && profile.phone && (
                <p className="text-muted">
                  <i className="bi bi-telephone"></i> {profile.phone}
                </p>
              )}
              <p>{profile.bio}</p>
              <div className="d-flex justify-content-center mb-3">
                <div className="mx-3">
                  <strong>{profile.followers}</strong>
                  <p>팔로워</p>
                </div>
                <div className="mx-3">
                  <strong>{profile.following}</strong>
                  <p>팔로잉</p>
                </div>
              </div>
              {isOwnProfile ? (
                <Button variant="outline-primary" className="w-100" onClick={handleEditProfile}>
                  프로필 편집
                </Button>
              ) : (
                <Button variant="primary" className="w-100">팔로우</Button>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
            <Card>
              <Card.Header>
                <Nav variant="tabs">
                  <Nav.Item>
                    <Nav.Link eventKey="posts">게시물</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="comments">댓글</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="liked">좋아요</Nav.Link>
                  </Nav.Item>
                </Nav>
              </Card.Header>
              <Card.Body>
                <Tab.Content>
                  <Tab.Pane eventKey="posts">
                    {profile.posts && profile.posts.length > 0 ? (
                      profile.posts.map(post => (
                        <div key={post.id} className="border-bottom mb-3 pb-3">
                          <h5>{post.title}</h5>
                          <p>{post.content.substring(0, 150)}...</p>
                          <div className="d-flex justify-content-between text-muted">
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                            <div>
                              <span className="me-3">
                                <i className="bi bi-heart"></i> {post.like_count || 0}
                              </span>
                              <span>
                                <i className="bi bi-chat"></i> {post.comment_count || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>작성한 게시물이 없습니다.</p>
                    )}
                  </Tab.Pane>
                  <Tab.Pane eventKey="comments">
                    <p>댓글이 없습니다.</p>
                  </Tab.Pane>
                  <Tab.Pane eventKey="liked">
                    <p>좋아요한 게시물이 없습니다.</p>
                  </Tab.Pane>
                </Tab.Content>
              </Card.Body>
            </Card>
          </Tab.Container>
        </Col>
      </Row>

      {/* 프로필 편집 모달 */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>프로필 편집</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {alert.show && (
            <Alert variant={alert.type} onClose={() => setAlert({...alert, show: false})} dismissible>
              {alert.message}
              {alert.details && <div><small>{alert.details}</small></div>}
            </Alert>
          )}
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>자기소개</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="bio"
                value={editForm.bio}
                onChange={handleEditFormChange}
                placeholder="자기소개를 입력하세요"
              />
            </Form.Group>

            <hr />
            <h6>프로필 이미지 설정</h6>
            <Form.Group className="mb-3">
              <Form.Label>이미지 URL</Form.Label>
              <Form.Control
                type="url"
                name="imageUrl"
                value={editForm.imageUrl}
                onChange={handleEditFormChange}
                placeholder="이미지 URL을 입력하세요 (예: https://example.com/image.jpg)"
              />
              <Form.Text className="text-muted">
                외부 이미지 URL을 입력하면 해당 이미지를 프로필 사진으로 설정합니다.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            취소
          </Button>
          <Button variant="primary" onClick={handleUpdateProfile}>
            정보 저장
          </Button>
          <Button variant="info" onClick={handleUpdateProfileImage}>
            이미지 URL 적용
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProfilePage;
