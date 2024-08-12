    function showsuccessAddMessage() {
    Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: 'Créditos adicionados',
    }).then((result) => {
        if (result.isConfirmed) {
            console.log('Redirecionando para /credits');
            window.location.href = '/credits';
        }
    });
}


function showsuccessRemoveMessage() {
    Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: 'Créditos removidos',
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/credits'; // Redireciona para a página de créditos
        }
    });
}


function showerrorCreditsAlert() {
    Swal.fire({
        icon: 'info',
        title: 'Erro',
        text: 'Vendedor não encontrado',
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/credits'; // Redireciona para a rota /register
        }
    });
}




    // Verifique se há mensagens de sucesso ou erro na URL
    const urlParams = new URLSearchParams(window.location.search);
    const successAddMessage = urlParams.get('successAddMessage');
    const successRemoveMessage = urlParams.get('successRemoveMessage');
    const errorVendedorAlert = urlParams.get('errorVendedorAlert');


    if (successAddMessage) {
    showsuccessAddMessage();
}

if (successRemoveMessage) {
    showsuccessRemoveMessage();
}

if (errorVendedorAlert) {
    showerrorCreditsAlert();
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

  const addButton = document.getElementById('addButton');
  const removeButton = document.getElementById('removeButton');
  const actionInput = document.getElementById('action');

  addButton.addEventListener('click', function () {
    actionInput.value = 'add';
  });

  removeButton.addEventListener('click', function () {
    actionInput.value = 'remove';
  });
