

log_inx = 0
def log(*args, **kwargs):
    global log_inx
    print(f"LOG PYTHON {log_inx:05}::", *args, **kwargs)
    log_inx += 1
    

err_inx = 0
def err(*args, **kwargs):
    global err_inx
    print(f"ERR PYTHON {err_inx:05}::", *args, **kwargs)
    err_inx += 1
