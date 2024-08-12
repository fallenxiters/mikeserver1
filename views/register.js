        document.getElementById('currentDateTime').value = new Date().toISOString();
    
// Função para exibir o alerta de sucesso
function showSuccessAlert(key) {
    Swal.fire({
        icon: 'success',
        iconColor: '#28a745', // Verde mais vivo para o ícone de sucesso
        title: 'Sucesso',
        html: `
            <p style="color: #fff;">Key criada:</p>
            <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
                <input id="keyField" type="text" value="${key}" readonly style="width: 70%; height: 40px; padding: 10px; border: 1px solid #555; border-radius: 5px; text-align: center; font-size: 1em; background-color: #1b1e21; color: #fff;">
                <button id="copyButton" class="swal2-confirm swal2-styled" style="width: auto; height: 40px; padding: 10px; margin-left: 10px; font-size: 1em; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <i class='bx bx-copy' style="font-size: 1.5em;"></i>
                </button>
            </div>`,
        background: '#343a40',
        color: '#fff', // Cor do texto
        showCancelButton: false,
        showConfirmButton: false,
        didOpen: () => {
            const copyButton = document.getElementById('copyButton');
            copyButton.addEventListener('click', () => {
                const keyField = document.getElementById('keyField');
                keyField.select();
                document.execCommand('copy');
                Swal.fire({
                    icon: 'success',
                    iconColor: '#28a745', // Verde mais vivo para o ícone de sucesso
                    title: 'Copiado!',
                    text: 'A key foi copiada para a área de transferência.',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#343a40',
                    color: '#fff' // Cor do texto
                }).then(() => {
                    window.location.href = '/register'; // Redireciona para a rota /register após copiar
                });
            });
        }
    });
}


// Função para obter o parâmetro da URL
function getParameterByName(name) {
    const url = new URL(window.location.href);
    const paramValue = url.searchParams.get(name);
    return paramValue;
}

// Verificar se há uma key na URL e mostrar o alerta de sucesso
document.addEventListener('DOMContentLoaded', () => {
    const key = getParameterByName('key');
    if (key) {
        showSuccessAlert(key);
    }
});


    
// Função para exibir o alerta de erro
function showErrorAlert() {
    Swal.fire({
        icon: 'error',
        iconColor: '#dc3545', // Vermelho para o ícone de erro
        title: 'Erro',
        text: 'Erro ao criar a key',
        background: '#343a40',
        color: '#fff', // Cor do texto
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/register'; // Redireciona para a rota /register
        }
    });
}

// Função para exibir o alerta de login existente
function showExistingLoginAlert() {
    Swal.fire({
        icon: 'error',
        iconColor: '#dc3545', // Azul para o ícone de info
        title: 'Erro',
        text: 'Key já existe',
        background: '#343a40',
        color: '#fff', // Cor do texto
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/register'; // Redireciona para a rota /register
        }
    });
}

// Função para exibir o alerta de créditos insuficientes
function showCreditsAlert() {
    Swal.fire({
        icon: 'error',
        iconColor: '#dc3545', // Amarelo para o ícone de info
        title: 'Erro',
        text: 'Adquira mais créditos',
        background: '#343a40',
        color: '#fff', // Cor do texto
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/register'; // Redireciona para a rota /register
        }
    });
}

    
        // Verifique se há mensagens de sucesso ou erro na URL
        const urlParams = new URLSearchParams(window.location.search);
        const successMessage = urlParams.get('successMessage');
        const errorMessage = urlParams.get('errorMessage');
        const existingLoginAlert = urlParams.get('existingLoginAlert');
        const creditsAlert = urlParams.get('creditsAlert');
    
        if (successMessage) {
            showSuccessAlert();
        }
    
        if (errorMessage) {
            showErrorAlert();
        }
    
        if (existingLoginAlert) {
            showExistingLoginAlert();
        }

        if (creditsAlert) {
            showCreditsAlert();
        }
    


document.addEventListener('DOMContentLoaded', function () {
    const sideLinks = document.querySelectorAll('.sidebar .side-menu li a:not(.logout)');

    sideLinks.forEach(item => {
        const li = item.parentElement;
        item.addEventListener('click', () => {
            sideLinks.forEach(i => {
                i.parentElement.classList.remove('active');
            });
            li.classList.add('active');
        });
    });

    const menuBar = document.querySelector('.content nav .bx.bx-menu');
    const sideBar = document.getElementById('sidebar');

    menuBar.addEventListener('click', () => {
        sideBar.classList.toggle('close');
    });

    const searchBtn = document.querySelector('.content nav form .form-input button');
    const searchBtnIcon = document.querySelector('.content nav form .form-input button .bx');
    const searchForm = document.querySelector('.content nav form');

    searchBtn.addEventListener('click', function (e) {
        if (window.innerWidth < 576) {
            e.preventDefault();
            searchForm.classList.toggle('show');
            if (searchForm.classList.contains('show')) {
                searchBtnIcon.classList.replace('bx-search', 'bx-x');
            } else {
                searchBtnIcon.classList.replace('bx-x', 'bx-search');
            }
        }
    });

    function handleResize() {
        if (window.innerWidth < 768) {
            sideBar.classList.add('close');
        } else {
            sideBar.classList.remove('close');
        }
        if (window.innerWidth > 576) {
            searchBtnIcon.classList.replace('bx-x', 'bx-search');
            searchForm.classList.remove('show');
        }
    }

    window.addEventListener('resize', handleResize);

    // Execute once on load
    handleResize();

    const toggler = document.getElementById('theme-toggle');

    toggler.addEventListener('change', function () {
        if (this.checked) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    });
});