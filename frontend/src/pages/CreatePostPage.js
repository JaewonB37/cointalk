import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import axios from 'axios';

const CreatePostPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    coins: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [allowHtml, setAllowHtml] = useState(true); // XSS 취약점: 항상 HTML 허용
  const [token, setToken] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [postId, setPostId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector(state => state.auth);
  
  // 편집 모드 초기화 및 데이터 로드 (통합된 useEffect)
  useEffect(() => {
    const initializeEditMode = async () => {
      // 1. URL 파라미터 확인
      const params = new URLSearchParams(location.search);
      const editMode = params.get('edit') === 'true';
      const id = params.get('id');
      
      if (!editMode || !id) {
        // 일반 작성 모드일 때는 토큰만 설정
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          setToken(savedToken);
        } else {
          await loginWithTestAccount();
        }
        return;
      }
      
      // 2. 토큰 확인/설정
      let currentToken = localStorage.getItem('token');
      if (!currentToken) {
        await loginWithTestAccount();
        currentToken = localStorage.getItem('token');
      }
      
      if (!currentToken) {
        setError('인증 토큰을 가져올 수 없습니다.');
        return;
      }
      
      // 3. 상태 업데이트
      setIsEditMode(true);
      setPostId(id);
      setToken(currentToken);
      
      // 4. 게시물 데이터 로드
      await fetchPost(id, currentToken);
    };
    
    initializeEditMode();
  }, [location.search]); // 단일 의존성
  
  // 게시물 데이터 불러오기 (수정된 함수)
  const fetchPost = async (id, authToken = null) => {
    try {
      const currentToken = authToken || token || localStorage.getItem('token');
      
      if (!currentToken) {
        setError('인증 토큰이 없습니다.');
        return;
      }
      
      const response = await axios.get(`http://localhost:5000/api/posts/${id}`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      // 올바른 데이터 접근 경로로 수정
      if (response.data.success && response.data.post) {
        const post = response.data.post;
        
        // 폼 데이터 업데이트
        setFormData({
          title: post.title || '',
          content: post.content || '',
          tags: post.tags ? post.tags.map(tag => tag.name || tag).join(', ') : '',
          coins: post.coins ? post.coins.map(coin => coin.symbol || coin).join(', ') : ''
        });
        
        // 기존 첨부파일 조회
        fetchExistingFiles(id);
        
        console.log('게시물 데이터 로드 완료:', post.title);
      } else {
        setError('게시물 데이터를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('게시물 불러오기 오류:', error);
      if (error.response?.status === 401) {
        setError('인증이 만료되었습니다. 다시 로그인해주세요.');
      } else if (error.response?.status === 404) {
        setError('존재하지 않는 게시물입니다.');
      } else {
        setError('게시물을 불러오는 중 오류가 발생했습니다.');
      }
    }
  };

  // 기존 첨부파일 조회
  const fetchExistingFiles = async (postId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/files/post/${postId}`);
      const result = await response.json();
      
      if (result.success && result.files) {
        setUploadedFiles(result.files);
      }
    } catch (error) {
      console.error('기존 파일 조회 오류:', error);
    }
  };
  
  // 테스트 계정으로 로그인 (개선된 함수)
  const loginWithTestAccount = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'test@example.com',
        password: 'testpass123'
      });
      
      if (response.data.success) {
        const newToken = response.data.token;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        console.log('자동 로그인 성공');
        return newToken;
      } else {
        throw new Error('로그인 응답이 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('자동 로그인에 실패했습니다. 수동으로 로그인해주세요.');
      return null;
    }
  }

  // 로그인하지 않은 사용자는 접근 불가
  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const userAuthenticated = isAuthenticated || !!localStorage.getItem('token');
  
  if (!userAuthenticated) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          게시물을 작성하려면 로그인해야 합니다.
          <br />
          <Button variant="link" onClick={() => navigate('/login')}>
            로그인하기
          </Button>
        </Alert>
      </Container>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  // 파일 업로드 함수
  const uploadFiles = async (postId) => {
    if (selectedFiles.length === 0) return [];

    // postId가 유효한지 확인
    if (!postId || postId === 'undefined' || postId === undefined) {
      throw new Error('유효하지 않은 게시물 ID입니다.');
    }

    const formData = new FormData();
    formData.append('postId', String(postId));
    
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('http://localhost:5000/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        setUploadedFiles(response.data.files);
        return response.data.files;
      }
      
      return [];
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      throw error;
    }
  };

  // 기존 파일 삭제 함수
  const handleFileDelete = async (fileId) => {
    if (!window.confirm('이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await axios.delete(`http://localhost:5000/api/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
      } else {
        setError('파일 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      setError('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { title, content, tags, coins } = formData;

      // 기본 유효성 검사
      if (!title.trim() || !content.trim()) {
        setError('제목과 내용을 입력해주세요.');
        setLoading(false);
        return;
      }

      // 의도적인 취약점: HTML 허용 시 XSS 공격 가능
      const processedTitle = allowHtml ? title : title; // HTML 이스케이프 안함
      const processedContent = allowHtml ? content : content; // HTML 이스케이프 안함

      // 태그와 코인 처리 (콤마로 구분된 문자열을 배열로 변환)
      const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
      const coinArray = coins ? coins.split(',').map(coin => coin.trim()).filter(coin => coin) : [];

      const postData = {
        title: processedTitle,
        content: processedContent,
        tags: tagArray,
        coins: coinArray,
        allowHtml: allowHtml // 서버에 HTML 허용 여부 전달
      };

      // 토큰이 없으면 오류
      if (!token) {
        setError('유효한 인증 토큰이 없습니다. 로그인해주세요.');
        setLoading(false);
        return;
      }
      
      console.log('사용할 토큰:', token);
      
      let response;
      
      if (isEditMode && postId) {
        // 게시물 수정 요청
        response = await axios.put(`http://localhost:5000/api/posts/${postId}`, postData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        // 게시물 생성 요청
        response = await axios.post('http://localhost:5000/api/posts', postData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }

      console.log('게시물 작성 응답:', response.data);

      if (response.data.success) {
        const newPostId = response.data.postId || response.data.post?.id || response.data.id;
        
        console.log('게시물 ID 추출:', newPostId, '응답 데이터:', response.data);
        
        // 파일 업로드 (게시물 작성 성공 후)
        if (selectedFiles.length > 0 && newPostId) {
          try {
            console.log('파일 업로드 시작:', selectedFiles.length, '개 파일');
            const uploadResult = await uploadFiles(newPostId);
            console.log('파일 업로드 완료:', uploadResult);
          } catch (uploadError) {
            console.error('파일 업로드 실패:', uploadError);
            // 파일 업로드 실패해도 게시물은 이미 생성되었으므로 성공 처리
            setError('게시물은 작성되었지만 파일 업로드에 실패했습니다.');
          }
        } else if (selectedFiles.length > 0) {
          console.error('게시물 ID가 없어서 파일 업로드를 건너뜁니다.');
          setError('게시물은 작성되었지만 파일 업로드에 실패했습니다.');
        }
        
        setSuccess(isEditMode ? '게시물이 성공적으로 수정되었습니다!' : '게시물이 성공적으로 작성되었습니다!');
        
        // 즉시 게시물 목록으로 이동
        navigate('/posts');
      } else {
        setError(response.data.message || '게시물 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('게시물 작성 오류:', error);
      if (error.response) {
        // 서버 응답이 있는 경우
        setError(error.response.data?.message || '서버 오류: ' + error.response.status);
        console.log('서버 응답 데이터:', error.response.data);
      } else if (error.request) {
        // 요청이 전송됐지만 응답이 없는 경우
        setError('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
      } else {
        // 요청 설정 중 오류가 발생한 경우
        setError('요청 중 오류 발생: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{isEditMode ? '게시물 수정' : '게시물 작성'}</h1>
        <Button variant="outline-secondary" onClick={() => navigate('/posts')}>
          목록으로 돌아가기
        </Button>
      </div>

      <Card>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert variant="success">
              {success}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>제목</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="게시물 제목을 입력하세요"
                required
                disabled={loading}
                maxLength={200}
              />
              <Form.Text className="text-muted">
                최대 200자까지 입력 가능합니다.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>내용</Form.Label>
              <Form.Control
                as="textarea"
                rows={10}
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="게시물 내용을 입력하세요"
                required
                disabled={loading}
              />
              <Form.Text className="text-muted"></Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>태그</Form.Label>
                  <Form.Control
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="태그1, 태그2, 태그3"
                    disabled={loading}
                  />
                  <Form.Text className="text-muted">
                    콤마(,)로 구분하여 여러 태그를 입력하세요.
                  </Form.Text>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>관련 코인</Form.Label>
                  <Form.Control
                    type="text"
                    name="coins"
                    value={formData.coins}
                    onChange={handleInputChange}
                    placeholder="BTC, ETH, ADA"
                    disabled={loading}
                  />
                  <Form.Text className="text-muted">
                    콤마(,)로 구분하여 관련 코인 심볼을 입력하세요.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* 파일 업로드 섹션 */}
            <Form.Group className="mb-3">
              <Form.Label>파일 첨부</Form.Label>
              <Form.Control
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={loading}
                accept="*/*"
              />
              <Form.Text className="text-muted">
                최대 10개 파일까지 업로드 가능합니다. (각 파일 최대 50MB)
                <br />
                지원 형식: 이미지, 문서, 압축파일, JavaScript 파일 등
              </Form.Text>
              
              {selectedFiles.length > 0 && (
                <div className="mt-2">
                  <strong>선택된 파일:</strong>
                  <ul className="list-unstyled mt-1">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="small text-muted">
                        📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className="progress">
                    <div 
                      className="progress-bar" 
                      role="progressbar" 
                      style={{width: `${uploadProgress}%`}}
                      aria-valuenow={uploadProgress} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    >
                      {uploadProgress}%
                    </div>
                  </div>
                </div>
              )}
              
              {uploadedFiles.length > 0 && (
                <div className="mt-2">
                  <Alert variant="info">
                    <strong>기존 첨부파일:</strong>
                    <ul className="list-unstyled mt-2 mb-0">
                      {uploadedFiles.map((file, index) => (
                        <li key={file.id || index} className="d-flex align-items-center justify-content-between mb-1">
                          <span className="small">
                            📎 {file.original_name} ({(file.file_size / 1024).toFixed(1)} KB)
                          </span>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleFileDelete(file.id)}
                            disabled={loading}
                          >
                            삭제
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Alert>
                </div>
              )}
            </Form.Group>



            <div className="d-flex justify-content-end gap-2">
              <Button 
                variant="outline-secondary" 
                type="button"
                onClick={() => navigate('/posts')}
                disabled={loading}
              >
                취소
              </Button>
              <Button 
                variant="primary" 
                type="submit"
                disabled={loading || !formData.title.trim() || !formData.content.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {isEditMode ? '수정 중...' : '작성 중...'}
                  </>
                ) : (
                  isEditMode ? '게시물 수정' : '게시물 작성'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CreatePostPage;