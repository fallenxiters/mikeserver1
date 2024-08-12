function showSuccessAlert() {
    Swal.fire({
        icon: 'success',
      iconColor: '#28a745',
        title: 'Sucesso',
        text: 'Key excluída',
        background: '#343a40',
        color: '#ffffff',
        confirmButtonColor: '#00cc66'  // Verde mais vivo para sucesso
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/remove'; // Redireciona para a rota /remove (ou outra rota apropriada)
        }
    });
}

// Função para exibir o alerta de erro
function showErrorAlert() {
    Swal.fire({
        icon: 'error',
      iconColor: '#dc3545',
        title: 'Erro',
        text: 'Erro ao excluir a key',
        background: '#343a40',
        color: '#ffffff',
        confirmButtonColor: '#ff3333'  // Vermelho mais vivo para erro
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/remove'; // Redireciona para a rota /remove (ou outra rota apropriada)
        }
    });
}

// Função para exibir o alerta de key inexistente
function showNonexistentLoginAlert() {
    Swal.fire({
        icon: 'error',
      iconColor: '#dc3545',
        title: 'Erro',
        text: 'Key não encontrada',
        background: '#343a40',
        color: '#ffffff',
        confirmButtonColor: '#17a2b8'  // Azul para informação
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/remove'; // Redireciona para a rota /remove (ou outra rota apropriada)
        }
    });
}

// Função para exibir o alerta de erro de remoção
function showErrorRemoveAlert() {
    Swal.fire({
        icon: 'error',
      iconColor: '#dc3545',
        title: 'Erro',
        text: 'Não é possível remover keys de outros vendedores',
        background: '#343a40',
        color: '#ffffff',
        confirmButtonColor: '#ff3333'  // Vermelho mais vivo para erro
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/remove'; // Redireciona para a rota /remove (ou outra rota apropriada)
        }
    });
}



    // Verifique se há mensagens de sucesso ou erro na URL
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('successMessage');
    const errorMessage = urlParams.get('errorMessage');
    const nonexistentLoginAlert = urlParams.get('nonexistentLoginAlert');
    const errorRemoveAlert = urlParams.get('errorRemoveAlert');
    const SuccessAlertVendedor = urlParams.get('SuccessAlertVendedor');

    if (successMessage) {
        showSuccessAlert();
    }

    if (errorMessage) {
        showErrorAlert();
    }

    if (nonexistentLoginAlert) {
        showNonexistentLoginAlert();
    }

    if (errorRemoveAlert) {
        showErrorRemoveAlert();
    }

    if (SuccessAlertVendedor) {
        showSuccessAlertVendedor();
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